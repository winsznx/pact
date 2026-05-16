// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {AgentNFT} from "../src/inft/AgentNFT.sol";
import {PactRegistry} from "../src/PactRegistry.sol";
import {ReputationVault} from "../src/ReputationVault.sol";
import {IReputationVault} from "../src/interfaces/IReputationVault.sol";

contract ReputationVaultTest is Test {
    AgentNFT internal agentNFT;
    PactRegistry internal registry;
    ReputationVault internal vault;

    // Stand-in for PactEscrow during pure-vault unit tests. Only the
    // INFT-portability test needs the full registry stack.
    address internal escrowSentinel = address(0xE5C200);

    address internal admin = address(0xA11CE);
    address internal sellerA;
    address internal sellerB;
    address internal buyer1 = address(0xB011);
    address internal buyer2 = address(0xB022);
    address internal stranger = address(0x5712A);

    bytes32 constant CAPABILITY = keccak256(bytes("code-review"));

    event ReputationIncremented(
        uint256 indexed serviceId,
        uint128 jobAmount,
        uint128 buyerWeight,
        uint128 newWeightedScore
    );

    function setUp() public virtual {
        sellerA = address(0xA1);
        sellerB = address(0xB2);

        vm.startPrank(admin);
        AgentNFT impl = new AgentNFT();
        bytes memory initData = abi.encodeCall(
            AgentNFT.initialize,
            ("PACT INFT", "PACT", "ipfs://", address(0xDEAD), admin)
        );
        agentNFT = AgentNFT(address(new ERC1967Proxy(address(impl), initData)));

        registry = new PactRegistry(agentNFT);
        agentNFT.grantMinterRole(address(registry));

        vault = new ReputationVault(escrowSentinel);
        vm.stopPrank();
    }

    /*──────────────────────── access control ───────────────────────*/

    function test_recordSettlement_onlyEscrow_reverts() public {
        vm.prank(stranger);
        vm.expectRevert(ReputationVault.EscrowOnly.selector);
        vault.recordSettlement(1, buyer1, 1 ether);

        // Even the admin / deployer cannot call.
        vm.prank(admin);
        vm.expectRevert(ReputationVault.EscrowOnly.selector);
        vault.recordSettlement(1, buyer1, 1 ether);
    }

    /*──────────────────────── timestamps ───────────────────────────*/

    function test_recordSettlement_firstJob_setsFirstJobAt() public {
        uint64 t0 = uint64(block.timestamp);
        vm.prank(escrowSentinel);
        vault.recordSettlement(1, buyer1, 1 ether);

        IReputationVault.Reputation memory rep = vault.getReputation(1);
        assertEq(rep.firstJobAt, t0);
        assertEq(rep.lastJobAt, t0);
    }

    function test_recordSettlement_subsequentJob_updatesLastJobAt() public {
        // Pin both timestamps explicitly so the assertion doesn't depend on
        // Foundry's default initial timestamp.
        vm.warp(1_000_000);
        vm.prank(escrowSentinel);
        vault.recordSettlement(1, buyer1, 1 ether);

        vm.warp(1_003_600); // +1 hour
        vm.prank(escrowSentinel);
        vault.recordSettlement(1, buyer1, 1 ether);

        IReputationVault.Reputation memory rep = vault.getReputation(1);
        assertEq(rep.firstJobAt, 1_000_000, "firstJobAt latched on first call");
        assertEq(rep.lastJobAt, 1_003_600, "lastJobAt advances");
    }

    /*──────────────────────── counters ─────────────────────────────*/

    function test_recordSettlement_incrementsTotalJobs() public {
        vm.startPrank(escrowSentinel);
        for (uint256 i = 0; i < 5; i++) {
            vault.recordSettlement(1, buyer1, 0.1 ether);
        }
        vm.stopPrank();
        assertEq(vault.getReputation(1).totalJobs, 5);
    }

    function test_recordSettlement_accumulatesTotalVolume() public {
        vm.startPrank(escrowSentinel);
        vault.recordSettlement(1, buyer1, 1 ether);
        vault.recordSettlement(1, buyer1, 2 ether);
        vault.recordSettlement(1, buyer2, 3 ether);
        vm.stopPrank();
        assertEq(vault.getReputation(1).totalVolume, 6 ether);
    }

    /*──────────────────────── buyer weight ─────────────────────────*/

    function test_buyerWeight_zeroForNewBuyer() public {
        assertEq(vault.getBuyerWeight(buyer1), 0);
        assertEq(vault.getBuyerTotalVolume(buyer1), 0);
    }

    function test_buyerWeight_sqrtScaling() public {
        // 100 ether = 100e18; sqrt(100e18) = 10e9 = 1e10
        vm.prank(escrowSentinel);
        vault.recordSettlement(1, buyer1, 100 ether);
        assertEq(vault.getBuyerTotalVolume(buyer1), 100 ether);
        assertEq(vault.getBuyerWeight(buyer1), 1e10);

        // top up to 10000 ether total; sqrt(1e22) = 1e11
        vm.prank(escrowSentinel);
        vault.recordSettlement(1, buyer1, 9900 ether);
        assertEq(vault.getBuyerTotalVolume(buyer1), 10000 ether);
        assertEq(vault.getBuyerWeight(buyer1), 1e11);
    }

    /*──────────────────────── weighted score ───────────────────────*/

    function test_weightedScore_incrementsCorrectly() public {
        // amount=1e18, volume after=1e18, sqrt=1e9, jobWeight=1e18*1e9=1e27
        vm.prank(escrowSentinel);
        vault.recordSettlement(1, buyer1, 1 ether);
        assertEq(vault.getReputation(1).weightedScore, 1e27);
    }

    function test_weightedScore_compoundsAcrossMultipleJobs() public {
        vm.startPrank(escrowSentinel);
        vault.recordSettlement(1, buyer1, 1 ether);
        uint128 after1 = vault.getReputation(1).weightedScore;

        // After 2nd job at the same buyer: volume=2e18, sqrt floor =
        // 1414213562 (since 1414213562^2 ≈ 2e18 - 1e9). jobWeight =
        // 1e18 * 1414213562 = 1.414213562e27. newScore = 1e27 + 1.414...e27.
        vault.recordSettlement(1, buyer1, 1 ether);
        uint128 after2 = vault.getReputation(1).weightedScore;
        vm.stopPrank();

        assertGt(after2, after1, "score is monotone non-decreasing");
        assertEq(
            after2 - after1,
            1 ether * uint128(1414213562),
            "delta = amount * floor(sqrt(2e18))"
        );
    }

    /*──────────────────────── event ────────────────────────────────*/

    function test_emitsReputationIncremented() public {
        // First job at amount=1e18: buyerWeight=1e9, newScore=1e27.
        vm.expectEmit(true, false, false, true, address(vault));
        emit ReputationIncremented(7, 1 ether, 1e9, 1e27);
        vm.prank(escrowSentinel);
        vault.recordSettlement(7, buyer1, 1 ether);
    }

    /*──────────────────────── INFT portability ─────────────────────*/

    /// @notice The moat narrative: when the INFT transfers, reputation
    ///         (keyed by serviceId) goes with the new owner unchanged AND
    ///         PactRegistry.getSellerServices follows the INFT.
    function test_reputationTransfersWithINFT() public {
        vm.prank(sellerA);
        uint256 serviceId = registry.registerService(
            CAPABILITY,
            "zai-org/GLM-5-FP8",
            address(0xC0FFEE),
            address(0x517FE),  // signing addr
            "openrouter",
            "centralized",
            true,
            0.001 ether,
            8192,
            ""
        );
        uint256 tokenId = registry.getService(serviceId).inftTokenId;
        assertEq(agentNFT.ownerOf(tokenId), sellerA, "sellerA holds INFT initially");

        vm.startPrank(escrowSentinel);
        vault.recordSettlement(serviceId, buyer1, 5 ether);
        vault.recordSettlement(serviceId, buyer2, 10 ether);
        vm.stopPrank();

        IReputationVault.Reputation memory before = vault.getReputation(serviceId);
        assertEq(before.totalJobs, 2);
        assertEq(before.totalVolume, 15 ether);

        // INFT transfer — standard ERC-721 path on the upstream AgentNFT.
        vm.prank(sellerA);
        agentNFT.transferFrom(sellerA, sellerB, tokenId);
        assertEq(agentNFT.ownerOf(tokenId), sellerB, "sellerB now holds INFT");

        // Reputation, keyed by serviceId, is bit-exact unchanged.
        IReputationVault.Reputation memory rAfter = vault.getReputation(serviceId);
        assertEq(rAfter.totalJobs, before.totalJobs);
        assertEq(rAfter.totalVolume, before.totalVolume);
        assertEq(rAfter.weightedScore, before.weightedScore);
        assertEq(rAfter.firstJobAt, before.firstJobAt);
        assertEq(rAfter.lastJobAt, before.lastJobAt);

        // Listing follows ownership: sellerA's set is now empty,
        // sellerB's now contains the service.
        uint256[] memory aIds = registry.getSellerServices(sellerA);
        uint256[] memory bIds = registry.getSellerServices(sellerB);
        assertEq(aIds.length, 0, "sellerA's listing is empty post-transfer");
        assertEq(bIds.length, 1, "sellerB now lists the service");
        assertEq(bIds[0], serviceId);
    }
}
