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
import {ISlashingArbiter} from "../src/interfaces/ISlashingArbiter.sol";

/// @notice Drives the full PactEscrow ↔ SlashingArbiter lifecycle so the
///         three invariants get real coverage. Stake / settle / dispute /
///         rotate / arbitrate. Rotation is the only path that produces a
///         slash (registered signingAddress diverges from the one the job's
///         attestation was signed against).
contract Handler is Test {
    PactEscrow internal immutable escrow;
    PactRegistry internal immutable registry;
    SlashingArbiter internal immutable arbiter;
    address internal immutable treasury;

    // The seller and signer key are shared across all services so the
    // handler can always produce a valid attestation. Diversity is in
    // serviceIds, buyers, disputers, and the rotation path.
    address internal immutable seller;
    uint256 internal immutable signerPk;
    address internal immutable signerAddr;
    address[] internal buyers;
    address[] internal disputers;
    uint256[] public services;

    uint256[] public settledJobs;
    uint256[] public openDisputeJobIds;
    mapping(uint256 => address) public disputerOfJob;
    mapping(uint256 => uint128) public originalDisputerBond;

    /// Tracking for invariants
    mapping(uint256 => uint256) public arbitrateAttemptsByJob;
    uint256 public successfulArbitrates;

    struct SlashRecord {
        uint128 totalSlashed;
        uint128 toDisputer;
        uint128 toTreasury;
        uint128 toBurn;
    }
    SlashRecord[] private _slashRecords;

    constructor(
        PactEscrow escrow_,
        PactRegistry registry_,
        SlashingArbiter arbiter_,
        address treasury_,
        address seller_,
        uint256 signerPk_,
        address signerAddr_,
        address[] memory buyers_,
        address[] memory disputers_,
        uint256[] memory services_
    ) {
        escrow = escrow_;
        registry = registry_;
        arbiter = arbiter_;
        treasury = treasury_;
        seller = seller_;
        signerPk = signerPk_;
        signerAddr = signerAddr_;
        buyers = buyers_;
        disputers = disputers_;
        services = services_;
    }

    function stake(uint256 idx, uint128 amtSeed) external {
        uint256 sId = services[bound(idx, 0, services.length - 1)];
        uint128 minBond = arbiter.MIN_BOND();
        uint128 amt = uint128(bound(amtSeed, minBond, minBond + 100 ether));
        vm.deal(seller, amt);
        vm.prank(seller);
        try arbiter.stakeBond{value: amt}(sId) {} catch {}
    }

    function createSettle(uint256 idx, uint128 amtSeed) external {
        uint256 sId = services[bound(idx, 0, services.length - 1)];
        uint128 amt = uint128(bound(amtSeed, 1e14, 1 ether));
        address buyer = buyers[bound(idx, 0, buyers.length - 1)];
        vm.deal(buyer, amt);

        uint256 jobId;
        vm.prank(buyer);
        try escrow.createJob{value: amt}(sId, "", 1 hours) returns (uint256 jId) {
            jobId = jId;
        } catch {
            return;
        }

        // Distinct chatId per attempt; collision short-circuits.
        bytes32 chatId = keccak256(abi.encode("invchat", jobId, idx, amtSeed));
        if (escrow.isChatIdUsed(chatId)) return;

        // Sign with the registered signer key. If the service was rotated,
        // signingAddress now diverges from signerAddr → submitAttestation
        // reverts → settle fails. Acceptable; the invariant suite
        // continues exercising other paths.
        bytes memory text = abi.encodePacked("inv-arbiter:", jobId);
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(text);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(seller);
        try escrow.submitAttestation(jobId, bytes32(0), chatId, text, sig) {
            settledJobs.push(jobId);
        } catch {}
    }

    function disputeJob(uint256 idx) external {
        if (settledJobs.length == 0) return;
        uint256 jobId = settledJobs[bound(idx, 0, settledJobs.length - 1)];
        IPactEscrow.Job memory job = escrow.getJob(jobId);
        if (job.state != IPactEscrow.JobState.Settled) return;

        address d = disputers[bound(idx, 0, disputers.length - 1)];
        uint128 db = escrow.DISPUTE_BOND();
        vm.deal(d, uint256(db) + 1 ether);

        vm.prank(d);
        try escrow.dispute{value: db}(jobId) {
            openDisputeJobIds.push(jobId);
            disputerOfJob[jobId] = d;
            originalDisputerBond[jobId] = db;
        } catch {}
    }

    /// @notice Rotate the registered signingAddress AWAY from `signerAddr`,
    ///         which is what handler-produced attestations were signed by.
    ///         Subsequent arbitrate calls on settled jobs will recover the
    ///         original signer and find a mismatch → slash path engaged.
    function rotateAwayFromSigner(uint256 idx) external {
        uint256 sId = services[bound(idx, 0, services.length - 1)];
        // Make a deterministic-but-rotating "new" address that's never
        // equal to signerAddr.
        address newAddr = address(uint160(uint256(keccak256(abi.encode("rot", idx, sId)))));
        if (newAddr == address(0)) newAddr = address(0xBEEF);
        if (newAddr == signerAddr) newAddr = address(uint160(uint256(uint160(newAddr)) ^ 1));

        vm.prank(seller);
        try registry.rotateSigningAddress(sId, newAddr) {} catch {}
    }

    /// @notice Restore the registered signingAddress to `signerAddr` so
    ///         the dispute-fails (no slash) path can also be exercised.
    function rotateBackToSigner(uint256 idx) external {
        uint256 sId = services[bound(idx, 0, services.length - 1)];
        vm.prank(seller);
        try registry.rotateSigningAddress(sId, signerAddr) {} catch {}
    }

    function arbitrateJob(uint256 idx) external {
        if (openDisputeJobIds.length == 0) return;
        uint256 jobId = openDisputeJobIds[bound(idx, 0, openDisputeJobIds.length - 1)];
        arbitrateAttemptsByJob[jobId] += 1;

        IPactEscrow.Job memory job = escrow.getJob(jobId);
        (uint128 sellerBondBefore, ) = arbiter.getBond(job.serviceId);
        address d = disputerOfJob[jobId];
        uint128 dBond = originalDisputerBond[jobId];

        uint256 disputerBalBefore = d.balance;
        uint256 treasuryBalBefore = treasury.balance;
        uint256 burnBalBefore = address(0).balance;

        try arbiter.arbitrate(jobId) {
            successfulArbitrates += 1;

            // Slash detection: seller bond was non-zero before, zero after.
            (uint128 sellerBondAfter, ) = arbiter.getBond(job.serviceId);
            if (sellerBondBefore > 0 && sellerBondAfter == 0) {
                uint256 disputerDelta = d.balance - disputerBalBefore;
                uint256 treasuryDelta = treasury.balance - treasuryBalBefore;
                uint256 burnDelta = address(0).balance - burnBalBefore;
                // Disputer delta = original bond refund + slash share.
                _slashRecords.push(SlashRecord({
                    totalSlashed: sellerBondBefore,
                    toDisputer: uint128(disputerDelta - dBond),
                    toTreasury: uint128(treasuryDelta),
                    toBurn: uint128(burnDelta)
                }));
            }
        } catch {}
    }

    /*──────────────────────── view exposers ────────────────────────*/

    function settledJobsLength() external view returns (uint256) { return settledJobs.length; }
    function openDisputeJobIdsLength() external view returns (uint256) { return openDisputeJobIds.length; }
    function servicesLength() external view returns (uint256) { return services.length; }
    function slashRecordsLength() external view returns (uint256) { return _slashRecords.length; }
    function slashRecord(uint256 i) external view returns (SlashRecord memory) { return _slashRecords[i]; }
}

contract SlashingArbiterInvariantsTest is StdInvariant, Test {
    AgentNFT internal agentNFT;
    AttestationVerifier internal verifier;
    ReputationVault internal vault;
    SlashingArbiter internal arbiter;
    PactRegistry internal registry;
    PactEscrow internal escrow;
    Handler internal handler;

    address internal admin = address(0xA11CE);
    address internal treasury = address(0xFEE);
    address internal seller;
    uint256 internal sellerPk;
    address internal signerAddr;
    uint256 internal signerPk;

    function setUp() public {
        (seller, sellerPk) = makeAddrAndKey("inv-arb-seller");
        (signerAddr, signerPk) = makeAddrAndKey("inv-arb-signer");

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

        uint64 nonce = vm.getNonce(address(this));
        address predictedEscrow = vm.computeCreateAddress(address(this), nonce + 2);
        vault = new ReputationVault(predictedEscrow);
        arbiter = new SlashingArbiter(registry, IPactEscrow(predictedEscrow), verifier, treasury);
        escrow = new PactEscrow(registry, verifier, vault, arbiter, treasury);
        require(address(escrow) == predictedEscrow, "escrow addr prediction failed");

        vm.prank(admin);
        agentNFT.grantMinterRole(address(registry));

        // Pre-register 3 services, all with the same signer key so the
        // handler can produce valid attestations from one secret.
        uint256[] memory serviceIds = new uint256[](3);
        for (uint256 i = 0; i < 3; ++i) {
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

        address[] memory buyers = new address[](3);
        buyers[0] = address(0xBEEF1);
        buyers[1] = address(0xBEEF2);
        buyers[2] = address(0xBEEF3);

        address[] memory disputers = new address[](2);
        disputers[0] = address(0xD15A);
        disputers[1] = address(0xD15B);

        handler = new Handler(
            escrow, registry, arbiter, treasury,
            seller, signerPk, signerAddr,
            buyers, disputers, serviceIds
        );
        targetContract(address(handler));
    }

    /*──────────────────────── invariants ───────────────────────────*/

    /// @notice User-spec'd 1: address(arbiter).balance ==
    ///         sum(active seller bonds) +
    ///         sum(unresolved disputer bonds).
    ///         (Pending withdrawals stay in seller bonds until withdrawBond
    ///         actually fires; slash distribution is atomic so no
    ///         "slash-pending" bucket exists in v0.1.)
    function invariant_bondCustody() public view {
        uint256 sumSellerBonds;
        uint256 nServices = handler.servicesLength();
        for (uint256 i = 0; i < nServices; ++i) {
            (uint128 amt, ) = arbiter.getBond(handler.services(i));
            sumSellerBonds += amt;
        }

        uint256 sumDisputerBonds;
        uint256 nDisputed = handler.openDisputeJobIdsLength();
        for (uint256 i = 0; i < nDisputed; ++i) {
            uint256 jobId = handler.openDisputeJobIds(i);
            ( , uint128 disputeBond, , bool resolved) = arbiter.getDispute(jobId);
            // Resolved disputes have already paid out; only count unresolved.
            if (!resolved) sumDisputerBonds += disputeBond;
        }

        assertEq(
            address(arbiter).balance,
            sumSellerBonds + sumDisputerBonds,
            "arbiter balance != sum(seller bonds) + sum(unresolved disputer bonds)"
        );
    }

    /// @notice User-spec'd 2: every recorded slash distributes the seller
    ///         bond exactly — no rounding loss, no overpayment.
    function invariant_slashDistribution() public view {
        uint256 n = handler.slashRecordsLength();
        for (uint256 i = 0; i < n; ++i) {
            Handler.SlashRecord memory r = handler.slashRecord(i);
            assertEq(
                uint256(r.toDisputer) + r.toTreasury + r.toBurn,
                r.totalSlashed,
                "slash shares do not sum to total slashed bond"
            );
        }
    }

    /// @notice User-spec'd 3: each jobId can be arbitrated at most once.
    ///         If `arbitrated[jobId]` is true, we should not have observed
    ///         more than one *successful* arbitrate call on it.
    function invariant_arbitrateOnce() public view {
        uint256 nDisputed = handler.openDisputeJobIdsLength();
        uint256 successfulArbs;
        for (uint256 i = 0; i < nDisputed; ++i) {
            uint256 jobId = handler.openDisputeJobIds(i);
            if (arbiter.arbitrated(jobId)) {
                ++successfulArbs;
            }
        }
        // Each successful arbitrate corresponds to exactly one
        // `arbitrated[jobId] == true`. The handler increments
        // `successfulArbitrates` on each non-reverting arbitrate; if any
        // duplicate had succeeded, it would exceed the count of
        // arbitrated-true jobs.
        assertEq(
            handler.successfulArbitrates(),
            successfulArbs,
            "successful arbitrate count diverged from arbitrated[] flags"
        );
    }
}
