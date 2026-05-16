// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {AgentNFT} from "../src/inft/AgentNFT.sol";
import {AttestationVerifier} from "../src/AttestationVerifier.sol";
import {PactEscrow} from "../src/PactEscrow.sol";
import {PactRegistry} from "../src/PactRegistry.sol";
import {ReputationVault} from "../src/ReputationVault.sol";
import {SlashingArbiter} from "../src/SlashingArbiter.sol";
import {IPactEscrow} from "../src/interfaces/IPactEscrow.sol";
import {IPactRegistry} from "../src/interfaces/IPactRegistry.sol";
import {IReputationVault} from "../src/interfaces/IReputationVault.sol";

contract PactEscrowTest is Test {
    AgentNFT internal agentNFT;
    AttestationVerifier internal verifier;
    ReputationVault internal vault;
    SlashingArbiter internal arbiter;
    PactRegistry internal registry;
    PactEscrow internal escrow;

    address internal admin = address(0xA11CE);
    address internal seller;
    uint256 internal sellerPk;
    address internal buyer = address(0xB0B);
    address internal stranger = address(0x57AA);
    address internal treasury = address(0xFEE);

    // Live G5 fixture — same as AttestationVerifier.t.sol §15.1.
    bytes constant CAPTURED_TEXT =
        "df0870f9b6a0bafc8223cebee0581160c6ea69876e57be3fa4e412450cd0b88e:0a2d1a40916f10253302e59bd1f1ea7dca6616fe4e816e3cd683310c5711eed6:centralized:openrouter:84c05f5412b2f6357c22c1fd3f9d345b9ac02e99254491a05b589b46570d3ba9";
    bytes constant CAPTURED_SIG =
        hex"99946cf42f441ae8756cc899f74054926c8b9d4ae5b570499783da23ae73393a647dc0f9a188159876d1ba52b42bdc0b837ccaaf0ccf79b93449a16b1f9fab831c";
    address constant CAPTURED_SIGNER = 0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8;
    address constant G5_PROVIDER = 0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C;

    bytes32 constant CAPABILITY = keccak256(bytes("code-review"));
    bytes32 constant SAMPLE_CHAT_ID = bytes32(uint256(0x5264f87175524ce384fa52203864a568));
    bytes32 constant SAMPLE_OUTPUT_ROOT = bytes32(uint256(0x31f1dbc6bcfcc56d0a9cecb9edcc1299c865536985a8ef653e09ffc34530779d));

    event JobCreated(
        uint256 indexed jobId,
        uint256 indexed serviceId,
        address indexed buyer,
        bytes32 inputCommitment,
        uint128 amount,
        uint64 timeout
    );
    event JobAttested(
        uint256 indexed jobId,
        bytes32 outputRootHash,
        bytes32 chatId,
        address recoveredSigner
    );
    event JobSettled(
        uint256 indexed jobId,
        address indexed seller,
        uint128 paidToSeller,
        uint128 protocolFee
    );
    event JobExpired(uint256 indexed jobId, address indexed buyer, uint128 refunded);
    event JobDisputed(uint256 indexed jobId, address indexed disputer);

    function setUp() public virtual {
        // Seller is whoever the registered service.seller is; the
        // signingAddress (CAPTURED_SIGNER) is the TEE proxy key, NOT the
        // seller. The seller calls submitAttestation; the captured signature
        // is what they hand the contract. We use a deterministic seller
        // address so tests are reproducible.
        (seller, sellerPk) = makeAddrAndKey("pact-seller");

        vm.startPrank(admin);
        AgentNFT impl = new AgentNFT();
        bytes memory initData = abi.encodeCall(
            AgentNFT.initialize,
            ("PACT INFT", "PACT", "ipfs://", address(0xDEAD), admin)
        );
        agentNFT = AgentNFT(address(new ERC1967Proxy(address(impl), initData)));

        verifier = new AttestationVerifier();
        registry = new PactRegistry(agentNFT);
        vm.stopPrank();

        // Both vault.escrow AND arbiter.escrow are immutable, AND
        // escrow.arbiter is immutable. Resolve the three-way cycle by
        // predicting the escrow CREATE address (= deployer nonce + 2),
        // then deploying vault → arbiter → escrow in order. Both vault
        // and arbiter share the same predicted escrow address. Keep the
        // deploys OUTSIDE the prank — vm.startPrank shifts CREATE deployer
        // semantics in a way that misaligns vm.computeCreateAddress.
        uint64 nonce = vm.getNonce(address(this));
        address predictedEscrow = vm.computeCreateAddress(address(this), nonce + 2);
        vault = new ReputationVault(predictedEscrow);
        arbiter = new SlashingArbiter(registry, IPactEscrow(predictedEscrow), verifier, treasury);
        escrow = new PactEscrow(registry, verifier, vault, arbiter, treasury);
        require(address(escrow) == predictedEscrow, "escrow address prediction failed");

        // Now grant minter role from the admin (admin is AgentNFT's ADMIN_ROLE).
        vm.prank(admin);
        agentNFT.grantMinterRole(address(registry));

        vm.deal(buyer, 100 ether);
        vm.deal(stranger, 100 ether);
    }

    /*──────────────────────── helpers ──────────────────────────────*/

    function _registerWith(address signingAddress) internal returns (uint256 serviceId) {
        vm.prank(seller);
        serviceId = registry.registerService(
            CAPABILITY,
            "zai-org/GLM-5-FP8",
            G5_PROVIDER,
            signingAddress,
            "openrouter",
            "centralized",
            true,
            0.001 ether,
            8192,
            ""
        );
    }

    function _createJob(uint256 serviceId, uint128 amount, uint64 timeoutSec)
        internal
        returns (uint256 jobId)
    {
        vm.prank(buyer);
        jobId = escrow.createJob{value: amount}(
            serviceId,
            hex"deadbeef",
            timeoutSec
        );
    }

    /*──────────────────────── createJob ────────────────────────────*/

    function test_createJob_locksEscrow_emitsEvent() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);

        bytes memory encInput = hex"deadbeef";
        uint128 amount = 1 ether;
        uint64 timeoutSec = 1 hours;
        uint64 expectedTimeout = uint64(block.timestamp) + timeoutSec;

        uint256 escrowBalanceBefore = address(escrow).balance;
        uint128 lockedBefore = escrow.totalLockedEscrow();

        vm.expectEmit(true, true, true, true, address(escrow));
        emit JobCreated(1, serviceId, buyer, keccak256(encInput), amount, expectedTimeout);

        vm.prank(buyer);
        uint256 jobId = escrow.createJob{value: amount}(serviceId, encInput, timeoutSec);

        assertEq(jobId, 1);
        assertEq(address(escrow).balance, escrowBalanceBefore + amount, "escrow holds the funds");
        assertEq(escrow.totalLockedEscrow(), lockedBefore + amount, "totalLockedEscrow incremented");

        IPactEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(IPactEscrow.JobState.Pending));
        assertEq(job.serviceId, serviceId);
        assertEq(job.buyer, buyer);
        assertEq(job.seller, seller);
        assertEq(job.amount, amount);
        assertEq(job.protocolFee, (amount * 500) / 10_000);
        assertEq(job.inputCommitment, keccak256(encInput));
        assertEq(job.timeout, expectedTimeout);
    }

    function test_createJob_rejectsInactiveService() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        vm.prank(seller);
        registry.delistService(serviceId);

        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        vm.expectRevert(PactEscrow.ServiceInactive.selector);
        escrow.createJob{value: 1 ether}(serviceId, "", 1 hours);
    }

    function test_createJob_rejectsZeroAmount() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        vm.prank(buyer);
        vm.expectRevert(PactEscrow.ZeroAmount.selector);
        escrow.createJob{value: 0}(serviceId, "", 1 hours);
    }

    /*──────────────────────── submitAttestation ────────────────────*/

    function test_submitAttestation_validG5Fixture_settles() public {
        // The full register → createJob → submitAttestation → settle
        // pipeline driven by the captured Phase 0 G5 bytes. If this
        // passes, on-chain settlement is bytes-for-bytes equivalent to
        // what 0G's signature endpoint produces in production.
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint256 jobId = _createJob(serviceId, 1 ether, 1 hours);

        uint128 expectedFee = (1 ether * 500) / 10_000;
        uint128 expectedSellerCut = uint128(1 ether) - expectedFee;
        uint256 sellerBalanceBefore = seller.balance;

        vm.expectEmit(true, false, false, true, address(escrow));
        emit JobAttested(jobId, SAMPLE_OUTPUT_ROOT, SAMPLE_CHAT_ID, CAPTURED_SIGNER);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit JobSettled(jobId, seller, expectedSellerCut, expectedFee);

        vm.prank(seller);
        escrow.submitAttestation(
            jobId,
            SAMPLE_OUTPUT_ROOT,
            SAMPLE_CHAT_ID,
            CAPTURED_TEXT,
            CAPTURED_SIG
        );

        IPactEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(IPactEscrow.JobState.Settled));
        assertEq(job.outputRootHash, SAMPLE_OUTPUT_ROOT);
        assertEq(job.chatId, SAMPLE_CHAT_ID);
        assertEq(job.attestationText, CAPTURED_TEXT);
        assertEq(job.attestationSignature, CAPTURED_SIG);

        assertEq(seller.balance, sellerBalanceBefore + expectedSellerCut, "seller paid");
        assertEq(escrow.protocolFeesPending(), expectedFee, "fee accrued");
        assertEq(escrow.totalLockedEscrow(), 0, "locked escrow cleared");
        assertEq(escrow.jobEscrowBalance(jobId), 0, "terminal-state escrow zero");
        assertTrue(escrow.isChatIdUsed(SAMPLE_CHAT_ID));

        // Reputation incremented for the seller's serviceId.
        IReputationVault.Reputation memory rep = vault.getReputation(serviceId);
        assertEq(rep.totalJobs, 1, "totalJobs +1");
        assertEq(rep.totalVolume, 1 ether, "totalVolume += amount");
        assertGt(rep.weightedScore, 0, "weightedScore set");
        assertEq(rep.firstJobAt, uint64(block.timestamp), "firstJobAt set on first call");
        assertEq(rep.lastJobAt, uint64(block.timestamp), "lastJobAt set");
    }

    function test_submitAttestation_wrongSigner_reverts() public {
        // Register with a deliberately wrong signer, but submit the captured
        // (text, sig) — verify() will recover the real CAPTURED_SIGNER and
        // fail the equality check.
        address bogusSigner = address(0xBADBADBADBADBADBADBADBADBADBADBAD);
        uint256 serviceId = _registerWith(bogusSigner);
        uint256 jobId = _createJob(serviceId, 1 ether, 1 hours);

        vm.prank(seller);
        vm.expectRevert(PactEscrow.AttestationInvalid.selector);
        escrow.submitAttestation(
            jobId,
            SAMPLE_OUTPUT_ROOT,
            SAMPLE_CHAT_ID,
            CAPTURED_TEXT,
            CAPTURED_SIG
        );
    }

    function test_submitAttestation_onlySeller() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint256 jobId = _createJob(serviceId, 1 ether, 1 hours);

        vm.prank(stranger);
        vm.expectRevert(PactEscrow.NotSeller.selector);
        escrow.submitAttestation(jobId, SAMPLE_OUTPUT_ROOT, SAMPLE_CHAT_ID, CAPTURED_TEXT, CAPTURED_SIG);
    }

    function test_submitAttestation_doubleSubmit_reverts() public {
        // Settle once; second submit on the same job hits NotPending.
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint256 jobId = _createJob(serviceId, 1 ether, 1 hours);

        vm.prank(seller);
        escrow.submitAttestation(jobId, SAMPLE_OUTPUT_ROOT, SAMPLE_CHAT_ID, CAPTURED_TEXT, CAPTURED_SIG);

        vm.prank(seller);
        vm.expectRevert(PactEscrow.NotPending.selector);
        escrow.submitAttestation(jobId, SAMPLE_OUTPUT_ROOT, SAMPLE_CHAT_ID, CAPTURED_TEXT, CAPTURED_SIG);
    }

    function test_submitAttestation_replayChatIdAcrossJobs_reverts() public {
        // Defense against §14.1 A2: same chatId reused on a fresh job.
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint256 jobA = _createJob(serviceId, 1 ether, 1 hours);
        uint256 jobB = _createJob(serviceId, 1 ether, 1 hours);

        vm.prank(seller);
        escrow.submitAttestation(jobA, SAMPLE_OUTPUT_ROOT, SAMPLE_CHAT_ID, CAPTURED_TEXT, CAPTURED_SIG);

        vm.prank(seller);
        vm.expectRevert(PactEscrow.ChatIdReused.selector);
        escrow.submitAttestation(jobB, SAMPLE_OUTPUT_ROOT, SAMPLE_CHAT_ID, CAPTURED_TEXT, CAPTURED_SIG);
    }

    /*──────────────────────── reclaimExpired ───────────────────────*/

    function test_reclaimExpired_returnsFullEscrow() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint256 jobId = _createJob(serviceId, 1 ether, 1 hours);

        vm.warp(block.timestamp + 1 hours + 1);
        uint256 buyerBefore = buyer.balance;

        vm.expectEmit(true, true, false, true, address(escrow));
        emit JobExpired(jobId, buyer, 1 ether);
        vm.prank(buyer);
        escrow.reclaimExpired(jobId);

        assertEq(buyer.balance, buyerBefore + 1 ether, "buyer fully refunded");
        IPactEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(IPactEscrow.JobState.Expired));
        assertEq(escrow.totalLockedEscrow(), 0);
        assertEq(escrow.jobEscrowBalance(jobId), 0);
    }

    function test_reclaimExpired_revertsBeforeTimeout() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint256 jobId = _createJob(serviceId, 1 ether, 1 hours);

        vm.prank(buyer);
        vm.expectRevert(PactEscrow.NotExpired.selector);
        escrow.reclaimExpired(jobId);
    }

    /*──────────────────────── dispute ──────────────────────────────*/

    function test_dispute_requiresBond_emitsEvent() public {
        // Dispute may only fire on a Settled job (PRD §3.3 SETTLED → DISPUTED).
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint256 jobId = _createJob(serviceId, 1 ether, 1 hours);
        vm.prank(seller);
        escrow.submitAttestation(jobId, SAMPLE_OUTPUT_ROOT, SAMPLE_CHAT_ID, CAPTURED_TEXT, CAPTURED_SIG);

        // Hoist the constant read out — vm.expectRevert applies to the NEXT
        // external call, and escrow.DISPUTE_BOND() is itself one.
        uint128 bond = escrow.DISPUTE_BOND();
        vm.deal(stranger, 1 ether);

        // Insufficient bond ⇒ revert (zero).
        vm.prank(stranger);
        vm.expectRevert(PactEscrow.BondTooSmall.selector);
        escrow.dispute{value: 0}(jobId);

        // Insufficient bond ⇒ revert (one wei short).
        vm.prank(stranger);
        vm.expectRevert(PactEscrow.BondTooSmall.selector);
        escrow.dispute{value: bond - 1}(jobId);

        // Sufficient bond ⇒ state transitions, event fires, bond custodied
        // by SlashingArbiter (escrow forwards immediately).
        uint256 arbiterBalBefore = address(arbiter).balance;
        uint256 escrowBalBefore = address(escrow).balance;
        vm.expectEmit(true, true, false, false, address(escrow));
        emit JobDisputed(jobId, stranger);
        vm.prank(stranger);
        escrow.dispute{value: bond}(jobId);

        IPactEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(IPactEscrow.JobState.Disputed));
        (, uint128 storedDisputeBond, , ) = arbiter.getDispute(jobId);
        assertEq(storedDisputeBond, bond, "arbiter custodies disputer bond");
        assertEq(address(arbiter).balance, arbiterBalBefore + bond, "bond forwarded to arbiter");
        assertEq(address(escrow).balance, escrowBalBefore, "escrow balance unchanged");
    }

    /*──────────────────────── treasury sweep ───────────────────────*/

    function test_sweepFees_treasuryOnly_drainsPending() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint256 jobId = _createJob(serviceId, 1 ether, 1 hours);
        vm.prank(seller);
        escrow.submitAttestation(jobId, SAMPLE_OUTPUT_ROOT, SAMPLE_CHAT_ID, CAPTURED_TEXT, CAPTURED_SIG);

        vm.prank(stranger);
        vm.expectRevert(PactEscrow.TreasuryOnly.selector);
        escrow.sweepFees();

        uint128 pending = escrow.protocolFeesPending();
        assertGt(pending, 0);
        uint256 treasuryBefore = treasury.balance;

        vm.prank(treasury);
        escrow.sweepFees();

        assertEq(treasury.balance, treasuryBefore + pending);
        assertEq(escrow.protocolFeesPending(), 0);
    }
}
