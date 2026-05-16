// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {AgentNFT} from "../src/inft/AgentNFT.sol";
import {AttestationVerifier} from "../src/AttestationVerifier.sol";
import {PactEscrow} from "../src/PactEscrow.sol";
import {PactRegistry} from "../src/PactRegistry.sol";
import {ReputationVault} from "../src/ReputationVault.sol";
import {SlashingArbiter} from "../src/SlashingArbiter.sol";
import {IPactEscrow} from "../src/interfaces/IPactEscrow.sol";
import {ISlashingArbiter} from "../src/interfaces/ISlashingArbiter.sol";

contract SlashingArbiterTest is Test {
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
    address internal disputer = address(0xD15);
    address internal stranger = address(0x57AA);
    address internal treasury = address(0xFEE);

    // Live G5 fixture (same as elsewhere)
    bytes constant CAPTURED_TEXT =
        "df0870f9b6a0bafc8223cebee0581160c6ea69876e57be3fa4e412450cd0b88e:0a2d1a40916f10253302e59bd1f1ea7dca6616fe4e816e3cd683310c5711eed6:centralized:openrouter:84c05f5412b2f6357c22c1fd3f9d345b9ac02e99254491a05b589b46570d3ba9";
    bytes constant CAPTURED_SIG =
        hex"99946cf42f441ae8756cc899f74054926c8b9d4ae5b570499783da23ae73393a647dc0f9a188159876d1ba52b42bdc0b837ccaaf0ccf79b93449a16b1f9fab831c";
    address constant CAPTURED_SIGNER = 0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8;
    address constant G5_PROVIDER = 0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C;

    bytes32 constant CAPABILITY = keccak256(bytes("code-review"));
    bytes32 constant SAMPLE_CHAT_ID = bytes32(uint256(0x5264f87175524ce384fa52203864a568));
    bytes32 constant SAMPLE_OUTPUT_ROOT = bytes32(uint256(0x31f1dbc6bcfcc56d0a9cecb9edcc1299c865536985a8ef653e09ffc34530779d));

    event BondStaked(uint256 indexed serviceId, address indexed staker, uint128 newTotal);
    event WithdrawalRequested(uint256 indexed serviceId, uint64 unlockAt);
    event BondWithdrawn(uint256 indexed serviceId, address indexed staker, uint128 amount);
    event DisputeFailed(
        uint256 indexed jobId,
        address indexed disputer,
        uint128 toSeller,
        uint128 toTreasury
    );
    event Slashed(
        uint256 indexed jobId,
        address indexed disputer,
        uint128 sellerBondSlashed,
        uint128 toDisputer,
        uint128 toTreasury,
        uint128 burned
    );

    function setUp() public virtual {
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

        // 3-way deploy cycle (see PactEscrow.t.sol setUp).
        uint64 nonce = vm.getNonce(address(this));
        address predictedEscrow = vm.computeCreateAddress(address(this), nonce + 2);
        vault = new ReputationVault(predictedEscrow);
        arbiter = new SlashingArbiter(registry, IPactEscrow(predictedEscrow), verifier, treasury);
        escrow = new PactEscrow(registry, verifier, vault, arbiter, treasury);
        require(address(escrow) == predictedEscrow, "escrow address prediction failed");

        vm.prank(admin);
        agentNFT.grantMinterRole(address(registry));

        vm.deal(seller, 1000 ether);
        vm.deal(buyer, 100 ether);
        vm.deal(disputer, 100 ether);
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

    function _settleJobWithG5(uint256 serviceId, uint128 jobAmount, bytes32 chatId)
        internal
        returns (uint256 jobId)
    {
        vm.prank(buyer);
        jobId = escrow.createJob{value: jobAmount}(serviceId, hex"de", 1 hours);

        vm.prank(seller);
        escrow.submitAttestation(jobId, SAMPLE_OUTPUT_ROOT, chatId, CAPTURED_TEXT, CAPTURED_SIG);
    }

    function _stakeMinBond(uint256 serviceId) internal {
        // Hoist the constant: vm.prank applies to the NEXT external call,
        // and `arbiter.MIN_BOND()` is itself one — without hoisting, the
        // prank gets consumed by the view and stakeBond runs unpranked.
        uint128 amt = arbiter.MIN_BOND();
        vm.prank(seller);
        arbiter.stakeBond{value: amt}(serviceId);
    }

    /*──────────────────────── stakeBond ────────────────────────────*/

    function test_stakeBond_minimumEnforced() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint128 minBond = arbiter.MIN_BOND();

        vm.prank(seller);
        vm.expectRevert(SlashingArbiter.BondTooSmall.selector);
        arbiter.stakeBond{value: minBond - 1}(serviceId);
    }

    function test_stakeBond_locksFunds_emitsEvent() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint128 minBond = arbiter.MIN_BOND();

        uint256 arbiterBalBefore = address(arbiter).balance;

        vm.expectEmit(true, true, false, true, address(arbiter));
        emit BondStaked(serviceId, seller, minBond);
        vm.prank(seller);
        arbiter.stakeBond{value: minBond}(serviceId);

        (uint128 storedAmt, uint64 withdrawableAt) = arbiter.getBond(serviceId);
        assertEq(storedAmt, minBond, "bond stored");
        assertEq(withdrawableAt, 0, "no withdrawal pending");
        assertEq(arbiter.bondPoster(serviceId), seller, "poster recorded");
        assertEq(address(arbiter).balance, arbiterBalBefore + minBond, "funds custodied");
    }

    function test_stakeBond_onlyOriginalRegistrant() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        uint128 minBond = arbiter.MIN_BOND();

        // INFT transfer makes someone else the "owner" — but bond posting
        // is keyed on Service.seller, the original registrant.
        uint256 tokenId = registry.getService(serviceId).inftTokenId;
        vm.prank(seller);
        agentNFT.transferFrom(seller, stranger, tokenId);

        vm.deal(stranger, 200 ether);
        vm.prank(stranger);
        vm.expectRevert(SlashingArbiter.NotOriginalRegistrant.selector);
        arbiter.stakeBond{value: minBond}(serviceId);

        // Original registrant can still stake.
        vm.prank(seller);
        arbiter.stakeBond{value: minBond}(serviceId);
        (uint128 amt2, ) = arbiter.getBond(serviceId);
        assertEq(amt2, minBond);
    }

    /*──────────────────────── two-phase withdraw ───────────────────*/

    function test_requestWithdrawal_setsTimestamp() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);

        uint64 delay = arbiter.WITHDRAWAL_DELAY();
        uint64 expectedUnlock = uint64(block.timestamp) + delay;

        vm.expectEmit(true, false, false, true, address(arbiter));
        emit WithdrawalRequested(serviceId, expectedUnlock);
        vm.prank(seller);
        arbiter.requestWithdrawal(serviceId);

        assertEq(arbiter.withdrawalUnlockAt(serviceId), expectedUnlock);

        // Cannot request again while one is in flight.
        vm.prank(seller);
        vm.expectRevert(SlashingArbiter.WithdrawalAlreadyRequested.selector);
        arbiter.requestWithdrawal(serviceId);
    }

    function test_withdrawBond_after7DayDelay_succeeds() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);
        uint128 bond = arbiter.MIN_BOND();
        uint64 delay = arbiter.WITHDRAWAL_DELAY();

        vm.prank(seller);
        arbiter.requestWithdrawal(serviceId);

        vm.warp(block.timestamp + delay + 1);

        uint256 sellerBefore = seller.balance;
        vm.expectEmit(true, true, false, true, address(arbiter));
        emit BondWithdrawn(serviceId, seller, bond);
        vm.prank(seller);
        arbiter.withdrawBond(serviceId);

        assertEq(seller.balance, sellerBefore + bond, "seller refunded");
        (uint128 finalAmt, uint64 finalUnlock) = arbiter.getBond(serviceId);
        assertEq(finalAmt, 0, "bond cleared");
        assertEq(finalUnlock, 0, "withdrawableAt cleared");
        assertEq(arbiter.bondPoster(serviceId), address(0), "poster cleared");
        assertEq(arbiter.withdrawalUnlockAt(serviceId), 0, "request cleared");
    }

    function test_withdrawBond_before7DayDelay_reverts() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);

        // Without requestWithdrawal first.
        vm.prank(seller);
        vm.expectRevert(SlashingArbiter.WithdrawalNotRequested.selector);
        arbiter.withdrawBond(serviceId);

        vm.prank(seller);
        arbiter.requestWithdrawal(serviceId);

        // 6 days, 23 hours — still short.
        vm.warp(block.timestamp + 6 days + 23 hours);
        vm.prank(seller);
        vm.expectRevert(SlashingArbiter.WithdrawalDelayNotElapsed.selector);
        arbiter.withdrawBond(serviceId);
    }

    function test_withdrawBond_withOpenDisputes_reverts() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);
        uint128 disputeBond = escrow.DISPUTE_BOND();
        uint64 delay = arbiter.WITHDRAWAL_DELAY();

        // Settle then dispute a job.
        uint256 jobId = _settleJobWithG5(serviceId, 1 ether, SAMPLE_CHAT_ID);
        vm.prank(disputer);
        escrow.dispute{value: disputeBond}(jobId);

        // Request withdrawal + warp past delay.
        vm.prank(seller);
        arbiter.requestWithdrawal(serviceId);
        vm.warp(block.timestamp + delay + 1);

        vm.prank(seller);
        vm.expectRevert(SlashingArbiter.OpenDisputesPending.selector);
        arbiter.withdrawBond(serviceId);
    }

    /*──────────────────────── arbitrate ────────────────────────────*/

    function test_arbitrate_validG5Signature_disputeFails_disputerLosesBond() public {
        // Signing address never rotated → arbitrate's recovery succeeds
        // → dispute fails → disputer's DISPUTE_BOND is consumed.
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);
        uint256 jobId = _settleJobWithG5(serviceId, 1 ether, SAMPLE_CHAT_ID);

        uint128 disputeBond = escrow.DISPUTE_BOND();
        vm.prank(disputer);
        escrow.dispute{value: disputeBond}(jobId);

        uint256 sellerBalBefore = seller.balance;
        uint256 treasuryBalBefore = treasury.balance;

        // 90% to seller, 10% to treasury (matches FAILED_DISPUTE_TREASURY_BPS=1000).
        uint128 expectedTreasury = uint128((uint256(disputeBond) * 1000) / 10_000);
        uint128 expectedSeller = disputeBond - expectedTreasury;

        vm.expectEmit(true, true, false, true, address(arbiter));
        emit DisputeFailed(jobId, disputer, expectedSeller, expectedTreasury);
        vm.prank(stranger);  // anyone can call arbitrate
        arbiter.arbitrate(jobId);

        assertEq(seller.balance, sellerBalBefore + expectedSeller, "seller compensated");
        assertEq(treasury.balance, treasuryBalBefore + expectedTreasury, "treasury fee");
        assertTrue(arbiter.arbitrated(jobId), "marked arbitrated");
        // Seller's MIN_BOND untouched.
        uint128 minBondConst = arbiter.MIN_BOND();
        (uint128 untouchedAmt, ) = arbiter.getBond(serviceId);
        assertEq(untouchedAmt, minBondConst, "seller bond intact");
        // Job state remains Disputed (not Slashed).
        IPactEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(IPactEscrow.JobState.Disputed));
    }

    function test_arbitrate_invalidSignature_slashes_70_20_10() public {
        // Settle correctly, then rotate the signing address — arbitrate's
        // recovery now mismatches → seller bond slashed 70/20/10.
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);
        uint128 sellerBondAmount = arbiter.MIN_BOND();
        uint256 jobId = _settleJobWithG5(serviceId, 1 ether, SAMPLE_CHAT_ID);

        // Rotate signing address — anything different from CAPTURED_SIGNER.
        vm.prank(seller);
        registry.rotateSigningAddress(serviceId, address(0xBEEF));

        uint128 disputeBond = escrow.DISPUTE_BOND();
        vm.prank(disputer);
        escrow.dispute{value: disputeBond}(jobId);

        uint128 expectedToDisputer = uint128((uint256(sellerBondAmount) * 7000) / 10_000);  // 70 ether
        uint128 expectedToTreasury = uint128((uint256(sellerBondAmount) * 2000) / 10_000);  // 20 ether
        uint128 expectedBurn = sellerBondAmount - expectedToDisputer - expectedToTreasury;  // 10 ether

        uint256 disputerBalBefore = disputer.balance;
        uint256 treasuryBalBefore = treasury.balance;
        uint256 burnAddrBalBefore = address(0).balance;

        vm.expectEmit(true, true, false, true, address(arbiter));
        emit Slashed(
            jobId,
            disputer,
            sellerBondAmount,
            expectedToDisputer,
            expectedToTreasury,
            expectedBurn
        );
        vm.prank(stranger);
        arbiter.arbitrate(jobId);

        // Disputer: original bond refunded + 70% slash share.
        assertEq(
            disputer.balance,
            disputerBalBefore + disputeBond + expectedToDisputer,
            "disputer = bond refund + 70% slash"
        );
        // Treasury: 20% slash share.
        assertEq(
            treasury.balance,
            treasuryBalBefore + expectedToTreasury,
            "treasury = 20% slash"
        );
        // Burn address: 10%.
        assertEq(
            address(0).balance,
            burnAddrBalBefore + expectedBurn,
            "burn = 10%"
        );
        (uint128 zeroedAmt, ) = arbiter.getBond(serviceId);
        assertEq(zeroedAmt, 0, "seller bond zeroed");

        // Job is now Slashed.
        IPactEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(IPactEscrow.JobState.Slashed));
    }

    function test_arbitrate_doubleCall_reverts() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);
        uint256 jobId = _settleJobWithG5(serviceId, 1 ether, SAMPLE_CHAT_ID);
        uint128 _db = escrow.DISPUTE_BOND();
        vm.prank(disputer);
        escrow.dispute{value: _db}(jobId);

        vm.prank(stranger);
        arbiter.arbitrate(jobId);

        vm.prank(stranger);
        vm.expectRevert(SlashingArbiter.AlreadyArbitrated.selector);
        arbiter.arbitrate(jobId);
    }

    function test_arbitrate_unrelatedJob_reverts() public {
        // Settle a job but never dispute → no DisputeRecord → arbitrate
        // reverts with NoDisputeFound.
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);
        uint256 jobId = _settleJobWithG5(serviceId, 1 ether, SAMPLE_CHAT_ID);

        vm.prank(stranger);
        vm.expectRevert(SlashingArbiter.NoDisputeFound.selector);
        arbiter.arbitrate(jobId);

        // Also: an entirely fictional jobId.
        vm.prank(stranger);
        vm.expectRevert(SlashingArbiter.NoDisputeFound.selector);
        arbiter.arbitrate(99_999);
    }

    /*──────────────────────── access on openDispute ────────────────*/

    function test_openDispute_onlyEscrow() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);
        uint256 jobId = _settleJobWithG5(serviceId, 1 ether, SAMPLE_CHAT_ID);

        // Random caller cannot open a dispute directly on the arbiter —
        // only PactEscrow.dispute() can.
        uint128 db = escrow.DISPUTE_BOND();
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(SlashingArbiter.EscrowOnly.selector);
        arbiter.openDispute{value: db}(jobId, disputer);
    }

    /*──────────────────────── v0.4 conformance ─────────────────────*/

    /// @notice PRD v0.4 §5.2 conformance: the JobSlashed event carries
    ///         the full (bondAmount, toDisputer, toTreasury, burned)
    ///         distribution. This test extracts the event from the
    ///         arbitrate() tx logs and checks each field matches the
    ///         actual on-chain transfer (or, for `bondAmount`, the
    ///         seller bond at slash time). Closes the loop on
    ///         IPactEscrow.markSlashed's new 6-arg signature.
    function test_jobSlashedEvent_carriesFullDistribution() public {
        // Same scenario as the slash test: register, stake, settle,
        // rotate, dispute, then arbitrate.
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);
        uint128 sellerBondAmount = arbiter.MIN_BOND();
        uint256 jobId = _settleJobWithG5(serviceId, 1 ether, SAMPLE_CHAT_ID);

        vm.prank(seller);
        registry.rotateSigningAddress(serviceId, address(0xBEEF));

        uint128 disputeBond = escrow.DISPUTE_BOND();
        vm.prank(disputer);
        escrow.dispute{value: disputeBond}(jobId);

        // Snapshot balances around arbitrate to derive ground-truth deltas.
        uint256 disputerBalBefore = disputer.balance;
        uint256 treasuryBalBefore = treasury.balance;
        uint256 burnAddrBalBefore = address(0).balance;

        vm.recordLogs();
        vm.prank(stranger);
        arbiter.arbitrate(jobId);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        // Locate the JobSlashed event by topic[0]. Indexed args land in
        // topics[1] and topics[2]; the 4 uint128s ride in `data`.
        bytes32 jobSlashedTopic = keccak256(
            "JobSlashed(uint256,address,uint128,uint128,uint128,uint128)"
        );

        bool found;
        uint256 evJobId;
        address evSeller;
        uint128 evBondAmount;
        uint128 evToDisputer;
        uint128 evToTreasury;
        uint128 evBurned;
        for (uint256 i = 0; i < logs.length; ++i) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == jobSlashedTopic) {
                // Event is from PactEscrow (escrow.markSlashed emits it).
                assertEq(logs[i].emitter, address(escrow), "JobSlashed emitted by escrow");
                evJobId = uint256(logs[i].topics[1]);
                evSeller = address(uint160(uint256(logs[i].topics[2])));
                (evBondAmount, evToDisputer, evToTreasury, evBurned) =
                    abi.decode(logs[i].data, (uint128, uint128, uint128, uint128));
                found = true;
                break;
            }
        }
        assertTrue(found, "JobSlashed not emitted");

        // Indexed event params match expectations.
        assertEq(evJobId, jobId, "event jobId");
        assertEq(evSeller, seller, "event slashedSeller");
        assertEq(evBondAmount, sellerBondAmount, "event bondAmount = staked bond");

        // The four shares in the event sum to the bond — same property
        // the invariant suite checks across fuzz, asserted here per-call.
        assertEq(
            uint256(evToDisputer) + evToTreasury + evBurned,
            evBondAmount,
            "shares sum to bondAmount"
        );

        // Each share matches the actual on-chain transfer.
        // Disputer received: original DISPUTE_BOND refund + the slash share.
        assertEq(
            disputer.balance - disputerBalBefore,
            uint256(disputeBond) + evToDisputer,
            "disputer balance delta = bond refund + event.toDisputer"
        );
        assertEq(
            treasury.balance - treasuryBalBefore,
            evToTreasury,
            "treasury balance delta = event.toTreasury"
        );
        assertEq(
            address(0).balance - burnAddrBalBefore,
            evBurned,
            "burn balance delta = event.burned"
        );
    }

    /*──────────────────────── PactEscrow.markSlashed access ────────*/

    function test_markSlashed_onlyArbiter() public {
        uint256 serviceId = _registerWith(CAPTURED_SIGNER);
        _stakeMinBond(serviceId);
        uint256 jobId = _settleJobWithG5(serviceId, 1 ether, SAMPLE_CHAT_ID);
        uint128 _db = escrow.DISPUTE_BOND();
        vm.prank(disputer);
        escrow.dispute{value: _db}(jobId);

        vm.prank(stranger);
        vm.expectRevert(PactEscrow.ArbiterOnly.selector);
        // PRD v0.4 §5.2: markSlashed takes the slash distribution as args.
        // The values don't matter for this access-control test — any uint128s do.
        escrow.markSlashed(jobId, seller, 0, 0, 0, 0);
    }
}
