// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";

import {ReputationVault} from "../src/ReputationVault.sol";
import {IReputationVault} from "../src/interfaces/IReputationVault.sol";

/// @notice Invariant Handler. Deployed at the address used as `escrow` in
///         the vault constructor — when the foundry runner calls these
///         functions, vm sees the handler as msg.sender and the access
///         control on `recordSettlement` passes.
///
///         The Handler is the ONLY writer to the vault — there is no other
///         path to mutate vault state. So the per-service expected
///         counters tracked here are authoritative ground truth for the
///         invariant suite.
contract Handler is Test {
    ReputationVault internal immutable vault;

    uint256[] public serviceIds;
    address[] public buyers;

    /// Authoritative shadow state — incremented in lockstep with successful
    /// vault writes inside `record`. The invariant suite verifies the vault's
    /// state matches.
    mapping(uint256 => uint128) public expectedTotalJobs;
    mapping(uint256 => uint128) public expectedTotalVolume;
    /// Maximum value ever observed for a serviceId. Used by the
    /// "monotonic non-decreasing" invariants — current value should
    /// never have dropped below this.
    mapping(uint256 => uint128) public maxObservedJobs;
    mapping(uint256 => uint128) public maxObservedScore;

    constructor(
        ReputationVault vault_,
        uint256[] memory serviceIds_,
        address[] memory buyers_
    ) {
        vault = vault_;
        serviceIds = serviceIds_;
        buyers = buyers_;
    }

    function record(
        uint256 svcSeed,
        uint256 buyerSeed,
        uint128 amountSeed
    ) external {
        uint256 svcId = serviceIds[bound(svcSeed, 0, serviceIds.length - 1)];
        address buyer = buyers[bound(buyerSeed, 0, buyers.length - 1)];
        uint128 amount = uint128(bound(amountSeed, 1, 1 ether));

        // Snapshot the pre-state in handler so we can detect any
        // monotonicity break inline.
        uint128 prevJobs = vault.getReputation(svcId).totalJobs;
        uint128 prevScore = vault.getReputation(svcId).weightedScore;

        try vault.recordSettlement(svcId, buyer, amount) {
            expectedTotalJobs[svcId] += 1;
            expectedTotalVolume[svcId] += amount;

            uint128 newJobs = vault.getReputation(svcId).totalJobs;
            uint128 newScore = vault.getReputation(svcId).weightedScore;
            require(newJobs >= prevJobs, "handler: jobs decreased");
            require(newScore >= prevScore, "handler: score decreased");

            if (newJobs > maxObservedJobs[svcId]) maxObservedJobs[svcId] = newJobs;
            if (newScore > maxObservedScore[svcId]) maxObservedScore[svcId] = newScore;
        } catch {
            // Reverts inside recordSettlement (e.g. on overflow at extreme
            // sqrt-amount combinations) leave shadow state untouched.
        }
    }

    function serviceIdsLength() external view returns (uint256) {
        return serviceIds.length;
    }
}

contract ReputationVaultInvariantsTest is StdInvariant, Test {
    ReputationVault internal vault;
    Handler internal handler;

    function setUp() public {
        // Predict handler address so the vault's `escrow` immutable is
        // already pointing at it when the handler starts firing.
        uint64 nonce = vm.getNonce(address(this));
        address predictedHandler = vm.computeCreateAddress(address(this), nonce + 1);
        vault = new ReputationVault(predictedHandler);

        uint256[] memory serviceIds = new uint256[](4);
        serviceIds[0] = 1;
        serviceIds[1] = 2;
        serviceIds[2] = 7;
        serviceIds[3] = 42;

        address[] memory buyers = new address[](4);
        buyers[0] = address(0xB0B1);
        buyers[1] = address(0xB0B2);
        buyers[2] = address(0xB0B3);
        buyers[3] = address(0xB0B4);

        handler = new Handler(vault, serviceIds, buyers);
        require(address(handler) == predictedHandler, "handler address prediction failed");

        targetContract(address(handler));
    }

    /// @notice Invariant 1: totalJobs is monotone non-decreasing.
    ///         No transition can lower totalJobs from any prior peak.
    function invariant_totalJobs_monotonicNonDecreasing() public view {
        uint256 n = handler.serviceIdsLength();
        for (uint256 i = 0; i < n; ++i) {
            uint256 svcId = handler.serviceIds(i);
            assertGe(
                vault.getReputation(svcId).totalJobs,
                handler.maxObservedJobs(svcId),
                "totalJobs dropped below prior peak"
            );
        }
    }

    /// @notice Invariant 2: totalVolume in the vault matches the sum of
    ///         amounts the handler has recorded for that serviceId.
    ///         If the vault ever silently truncates, double-counts, or
    ///         loses volume, this catches it.
    function invariant_totalVolume_matchesSumOfRecordedAmounts() public view {
        uint256 n = handler.serviceIdsLength();
        for (uint256 i = 0; i < n; ++i) {
            uint256 svcId = handler.serviceIds(i);
            assertEq(
                vault.getReputation(svcId).totalVolume,
                handler.expectedTotalVolume(svcId),
                "vault.totalVolume diverged from handler shadow"
            );
        }
    }

    /// @notice Invariant 3: weightedScore is monotone non-decreasing.
    ///         Sybil-discounting must never produce a downward step.
    ///         (v0.1 has no time-decay path; once Phase 2 adds decay, this
    ///         invariant will need updating.)
    function invariant_weightedScore_monotonicNonDecreasing() public view {
        uint256 n = handler.serviceIdsLength();
        for (uint256 i = 0; i < n; ++i) {
            uint256 svcId = handler.serviceIds(i);
            assertGe(
                vault.getReputation(svcId).weightedScore,
                handler.maxObservedScore(svcId),
                "weightedScore dropped below prior peak"
            );
        }
    }
}
