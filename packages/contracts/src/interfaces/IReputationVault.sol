// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IReputationVault
/// @notice Sybil-resistant reputation accumulator, INFT-bound.
/// @dev    Verbatim from MASTER_PRD v0.3 §5.4. PactEscrow calls
///         `recordSettlement` on every successful job settle. The vault
///         contract itself is implemented in Phase 1 step 2D — this
///         interface lets PactEscrow link to a stub or future
///         implementation by address.
interface IReputationVault {
    struct Reputation {
        uint128 totalJobs;
        uint128 totalVolume;
        uint128 weightedScore;     // sybil-discounted (see calc below)
        uint64  firstJobAt;
        uint64  lastJobAt;
    }

    event ReputationIncremented(
        uint256 indexed serviceId,
        uint128 jobAmount,
        uint128 buyerWeight,
        uint128 newWeightedScore
    );

    function getReputation(uint256 serviceId) external view returns (Reputation memory);
    function getBuyerWeight(address buyer) external view returns (uint128);

    /// @dev Called by PactEscrow on JobSettled.
    ///      weight = jobAmount * sqrt(buyerVolume) * timeDecay
    function recordSettlement(uint256 serviceId, address buyer, uint128 amount) external;
}
