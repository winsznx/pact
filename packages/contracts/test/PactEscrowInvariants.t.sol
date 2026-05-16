// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {AgentNFT} from "../src/inft/AgentNFT.sol";
import {AttestationVerifier} from "../src/AttestationVerifier.sol";
import {PactEscrow} from "../src/PactEscrow.sol";
import {PactRegistry} from "../src/PactRegistry.sol";
import {ReputationVault} from "../src/ReputationVault.sol";
import {SlashingArbiter} from "../src/SlashingArbiter.sol";
import {IPactEscrow} from "../src/interfaces/IPactEscrow.sol";

/// @notice Bounded-call wrapper around PactEscrow. Exposes the lifecycle
///         transitions the user-spec'd invariants care about:
///         createJob, submitAttestation, reclaimExpired (+ a clock jump).
///         Does NOT expose dispute() — the user's literal invariant
///         (`escrow == balance - fees`) excludes dispute bond accounting,
///         and dispute() unit tests cover that path separately.
contract Handler is Test {
    PactEscrow internal immutable escrow;
    PactRegistry internal immutable registry;

    uint256 internal immutable signerPk;
    address internal immutable seller;
    uint256[] public serviceIds;
    address[] public buyers;

    uint256[] public jobIds;
    uint256 public createdCount;
    uint256 public settledCount;
    uint256 public reclaimedCount;

    constructor(
        PactEscrow escrow_,
        PactRegistry registry_,
        uint256 signerPk_,
        address seller_,
        uint256[] memory serviceIds_,
        address[] memory buyers_
    ) {
        escrow = escrow_;
        registry = registry_;
        signerPk = signerPk_;
        seller = seller_;
        serviceIds = serviceIds_;
        buyers = buyers_;
    }

    function create(
        uint256 serviceSeed,
        uint256 buyerSeed,
        uint128 amountSeed,
        uint64 timeoutSeed
    ) external {
        uint256 serviceId = serviceIds[bound(serviceSeed, 0, serviceIds.length - 1)];
        address buyer = buyers[bound(buyerSeed, 0, buyers.length - 1)];
        uint128 amount = uint128(bound(amountSeed, 1, 1 ether));
        uint64 timeoutSec = uint64(bound(timeoutSeed, 1 minutes, 1 days));

        vm.prank(buyer);
        try escrow.createJob{value: amount}(serviceId, "", timeoutSec) returns (uint256 jobId) {
            jobIds.push(jobId);
            createdCount++;
        } catch {}
    }

    /// @notice Submit a fresh, valid attestation against a Pending job.
    ///         Signs arbitrary `text` with the registered signer key so
    ///         AttestationVerifier.verify recovers cleanly. This deliberately
    ///         bypasses the 5-field colon format — the on-chain verifier
    ///         only does ECDSA recovery, so any byte string suffices for
    ///         invariant fuzzing.
    function attest(uint256 jobSeed, bytes32 chatIdSeed, bytes32 outputRoot) external {
        if (jobIds.length == 0) return;
        uint256 jobId = jobIds[bound(jobSeed, 0, jobIds.length - 1)];
        IPactEscrow.Job memory job = escrow.getJob(jobId);
        if (job.state != IPactEscrow.JobState.Pending) return;
        if (block.timestamp >= job.timeout) return;
        if (escrow.isChatIdUsed(chatIdSeed)) return;

        bytes memory text = abi.encodePacked("inv:", jobId, chatIdSeed, outputRoot);
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(text);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(seller);
        try escrow.submitAttestation(jobId, outputRoot, chatIdSeed, text, sig) {
            settledCount++;
        } catch {}
    }

    function reclaim(uint256 jobSeed) external {
        if (jobIds.length == 0) return;
        uint256 jobId = jobIds[bound(jobSeed, 0, jobIds.length - 1)];
        IPactEscrow.Job memory job = escrow.getJob(jobId);
        if (job.state != IPactEscrow.JobState.Pending) return;
        if (block.timestamp < job.timeout) return;

        vm.prank(job.buyer);
        try escrow.reclaimExpired(jobId) {
            reclaimedCount++;
        } catch {}
    }

    /// @notice Time travel — without it, `reclaimExpired` is unreachable and
    ///         the totalEscrow invariant only exercises the create+settle path.
    function jumpTime(uint64 secs) external {
        uint64 hop = uint64(bound(secs, 30 seconds, 2 days));
        vm.warp(block.timestamp + hop);
    }

    function jobIdsLength() external view returns (uint256) {
        return jobIds.length;
    }
}

contract PactEscrowInvariantsTest is StdInvariant, Test {
    AgentNFT internal agentNFT;
    AttestationVerifier internal verifier;
    ReputationVault internal vault;
    SlashingArbiter internal arbiter;
    PactRegistry internal registry;
    PactEscrow internal escrow;
    Handler internal handler;

    address internal admin = address(0xA11CE);
    address internal seller;
    uint256 internal sellerPk;
    address internal signerAddr;
    uint256 internal signerPk;
    address internal treasury = address(0xFEE);

    function setUp() public {
        (seller, sellerPk) = makeAddrAndKey("inv-seller");
        (signerAddr, signerPk) = makeAddrAndKey("inv-signer");

        vm.startPrank(admin);
        AgentNFT impl = new AgentNFT();
        bytes memory initData = abi.encodeCall(
            AgentNFT.initialize,
            ("PACT", "PACT", "ipfs://", address(0xDEAD), admin)
        );
        agentNFT = AgentNFT(address(new ERC1967Proxy(address(impl), initData)));

        verifier = new AttestationVerifier();
        registry = new PactRegistry(agentNFT);
        vm.stopPrank();

        // Three-way cycle resolution — see PactEscrow.t.sol setUp for full
        // rationale. Vault + arbiter + escrow deploy OUTSIDE the prank.
        uint64 nonce = vm.getNonce(address(this));
        address predictedEscrow = vm.computeCreateAddress(address(this), nonce + 2);
        vault = new ReputationVault(predictedEscrow);
        arbiter = new SlashingArbiter(registry, IPactEscrow(predictedEscrow), verifier, treasury);
        escrow = new PactEscrow(registry, verifier, vault, arbiter, treasury);
        require(address(escrow) == predictedEscrow, "escrow address prediction failed");

        vm.prank(admin);
        agentNFT.grantMinterRole(address(registry));

        // Three services, all using the same signer key so the handler can
        // sign attestations with one secret.
        uint256[] memory serviceIds = new uint256[](3);
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(seller);
            serviceIds[i] = registry.registerService(
                keccak256(abi.encode("cap", i)),
                "model",
                address(uint160(0xC0FFEE + i)),
                signerAddr,
                "openrouter",
                "centralized",
                true,
                0.001 ether,
                8192,
                ""
            );
        }

        // Three buyers funded with plenty of $0G.
        address[] memory buyers = new address[](3);
        buyers[0] = address(0xBEEF1);
        buyers[1] = address(0xBEEF2);
        buyers[2] = address(0xBEEF3);
        for (uint256 i = 0; i < buyers.length; i++) {
            vm.deal(buyers[i], 1000 ether);
        }

        handler = new Handler(escrow, registry, signerPk, seller, serviceIds, buyers);
        targetContract(address(handler));
    }

    /// @notice User-spec'd invariant 1.
    ///         sum of {Pending, Sealed, Attested} amounts == balance - feesPending
    ///         Since v0.1 collapses Pending → Settled in one transition, the
    ///         Sealed/Attested buckets stay empty and the sum reduces to
    ///         "Pending amount sum" — which equals `escrow.totalLockedEscrow`.
    ///         We re-derive the sum by iterating handler-tracked jobs to
    ///         match the literal user spec rather than relying on the
    ///         contract's mirror state.
    function invariant_totalEscrowMatchesContractBalance() public view {
        uint256 sum;
        uint256 len = handler.jobIdsLength();
        for (uint256 i = 0; i < len; i++) {
            IPactEscrow.Job memory job = escrow.getJob(handler.jobIds(i));
            IPactEscrow.JobState s = job.state;
            if (
                s == IPactEscrow.JobState.Pending ||
                s == IPactEscrow.JobState.Sealed ||
                s == IPactEscrow.JobState.Attested
            ) {
                sum += job.amount;
            }
        }
        // Right side: balance minus fees-pending. Handler does not call
        // dispute(), so disputeBondsHeld is always 0 here.
        assertEq(
            sum,
            address(escrow).balance - escrow.protocolFeesPending(),
            "totalEscrow != balance - feesPending"
        );
    }

    /// @notice User-spec'd invariant 2.
    ///         forall job state==Settled =>
    ///         AttestationVerifier.verify(text, sig, signingAddress) == true
    ///         Validates that nothing past submitAttestation can leave a
    ///         Settled job in a state where its on-chain attestation no
    ///         longer recovers to the registered signer.
    function invariant_settledJobsHaveValidSignature() public view {
        uint256 len = handler.jobIdsLength();
        for (uint256 i = 0; i < len; i++) {
            uint256 jobId = handler.jobIds(i);
            IPactEscrow.Job memory job = escrow.getJob(jobId);
            if (job.state != IPactEscrow.JobState.Settled) continue;

            address registeredSigner = registry.getService(job.serviceId).signingAddress;
            assertTrue(
                verifier.verify(job.attestationText, job.attestationSignature, registeredSigner),
                "settled job stored an attestation that no longer verifies"
            );
        }
    }

    /// @notice User-spec'd invariant 3.
    ///         forall job state in {Settled, Slashed, Expired} =>
    ///         internal escrow accounting for that job is 0
    ///         Read via the public `jobEscrowBalance` helper which folds
    ///         the state-based zeroing logic into one call.
    function invariant_terminalStatesHaveZeroEscrow() public view {
        uint256 len = handler.jobIdsLength();
        for (uint256 i = 0; i < len; i++) {
            uint256 jobId = handler.jobIds(i);
            IPactEscrow.Job memory job = escrow.getJob(jobId);
            IPactEscrow.JobState s = job.state;
            if (
                s == IPactEscrow.JobState.Settled ||
                s == IPactEscrow.JobState.Slashed ||
                s == IPactEscrow.JobState.Expired
            ) {
                assertEq(escrow.jobEscrowBalance(jobId), 0, "terminal job retains escrow");
            }
        }
    }
}
