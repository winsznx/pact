// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IReputationVault} from "./interfaces/IReputationVault.sol";

/// @title ReputationVault
/// @notice Sybil-resistant reputation accumulator for PACT services.
/// @dev    Verbatim from MASTER_PRD v0.3 §5.4. Reputation is keyed by
///         `serviceId`, which is itself bound to an ERC-7857 INFT
///         (PactRegistry.Service.inftTokenId). When the INFT transfers,
///         reputation lookups by serviceId continue unchanged — no
///         on-chain plumbing needed for portability.
///
///         Sybil-resistance recipe (PRD §5.4 prose, §14.1 B1, B2):
///           buyerWeight    = sqrt(buyerTotalVolumePaid)
///           jobWeight      = jobAmount * buyerWeight
///           weightedScore += jobWeight
///         New buyers get near-zero weight; self-trading requires real $0G
///         that loses to the protocol fee on every loop (B2).
///
///         **Time decay deferred to Phase 2.** PRD §5.4's `weight = jobAmount
///         * sqrt(buyerVolume) * timeDecay` mentions a decay multiplier
///         but leaves the function shape undefined. v0.1 ships with no
///         decay — the score is monotone non-decreasing across
///         settlements. Phase 2 will introduce exponential decay (or the
///         half-life function the team picks) without touching the
///         interface. Documented in NatSpec on `recordSettlement`.
contract ReputationVault is IReputationVault {
    error EscrowOnly();
    error ZeroEscrow();

    address public immutable escrow;

    mapping(uint256 => Reputation) private _reputations;
    mapping(address => uint128) private _buyerTotalVolume;

    constructor(address escrow_) {
        if (escrow_ == address(0)) revert ZeroEscrow();
        escrow = escrow_;
    }

    /// @inheritdoc IReputationVault
    /// @dev v0.1 omits the `timeDecay` factor named in PRD §5.4 — see
    ///      contract-level NatSpec for rationale. Score is monotone
    ///      non-decreasing under v0.1.
    function recordSettlement(uint256 serviceId, address buyer, uint128 amount) external {
        if (msg.sender != escrow) revert EscrowOnly();

        // Accumulate buyer's total volume INCLUDING this job before computing
        // weight, so the buyer's first $1 paid contributes a non-zero weight
        // (sqrt(1)=1) rather than zero (sqrt(0)=0). Without this, the very
        // first settlement for any buyer would always score 0.
        uint128 buyerVolume = _buyerTotalVolume[buyer] + amount;
        _buyerTotalVolume[buyer] = buyerVolume;

        // OZ Math.sqrt(uint256) -> uint256. Result is always <= uint128.max
        // when input is uint128 (sqrt(2^128 - 1) ≈ 1.84e19, fits in uint64
        // even), so the downcast is safe.
        uint128 buyerWeight = uint128(Math.sqrt(uint256(buyerVolume)));

        // jobWeight = amount * buyerWeight, computed in uint256 to avoid
        // wraparound mid-multiplication. The downcast at the end is checked
        // by Solidity 0.8 — overflow reverts the settlement, which is
        // correct (the contract never silently truncates reputation).
        uint128 jobWeight = uint128(uint256(amount) * uint256(buyerWeight));

        Reputation storage rep = _reputations[serviceId];
        if (rep.totalJobs == 0) {
            rep.firstJobAt = uint64(block.timestamp);
        }
        rep.lastJobAt = uint64(block.timestamp);
        rep.totalJobs += 1;
        rep.totalVolume += amount;
        rep.weightedScore += jobWeight;

        emit ReputationIncremented(serviceId, amount, buyerWeight, rep.weightedScore);
    }

    /// @inheritdoc IReputationVault
    function getReputation(uint256 serviceId) external view returns (Reputation memory) {
        return _reputations[serviceId];
    }

    /// @inheritdoc IReputationVault
    function getBuyerWeight(address buyer) external view returns (uint128) {
        return uint128(Math.sqrt(uint256(_buyerTotalVolume[buyer])));
    }

    /// @notice Cumulative volume paid by a buyer across every settlement.
    ///         Exposed for invariant tests + indexer convenience.
    function getBuyerTotalVolume(address buyer) external view returns (uint128) {
        return _buyerTotalVolume[buyer];
    }
}
