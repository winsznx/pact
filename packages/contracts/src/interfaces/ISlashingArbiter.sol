// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISlashingArbiter
/// @notice Bond custody and dispute arbitration for the PACT protocol.
/// @dev    Verbatim from MASTER_PRD v0.3 §5.5 (the four functions named there)
///         plus three additions documented in the contract NatSpec:
///           - `requestWithdrawal(serviceId)` introduces the two-phase
///             withdrawal pattern PRD §3.3 references but doesn't spec out;
///             the 7-day delay between request and withdrawBond mitigates
///             §14.1 D1 (front-run withdrawal with dispute).
///           - `openDispute(jobId, disputer)` is called by PactEscrow.dispute()
///             to forward the disputer's bond and register the dispute so
///             the per-service open-dispute counter can gate withdrawals.
///           - `getDispute(jobId)` exposes the dispute record for indexer +
///             invariant tests.
///         These three are queued for the PRD §5.5 amendment.
interface ISlashingArbiter {
    struct DisputeRecord {
        address disputer;
        uint128 bond;
        uint64 openedAt;
        bool resolved;
    }

    event BondStaked(uint256 indexed serviceId, address indexed staker, uint128 newTotal);
    event WithdrawalRequested(uint256 indexed serviceId, uint64 unlockAt);
    event BondWithdrawn(uint256 indexed serviceId, address indexed staker, uint128 amount);
    event DisputeOpened(uint256 indexed jobId, address indexed disputer, uint128 bond);
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

    /// @notice Stake (or top up) a bond for `serviceId`. Caller must be the
    ///         original registrant (PactRegistry.Service.seller). v0.1 keeps
    ///         the bond as the operator's responsibility — INFT transfer
    ///         does NOT move bond ownership.
    function stakeBond(uint256 serviceId) external payable;

    /// @notice Initiate the 7-day delay before bond can be withdrawn.
    function requestWithdrawal(uint256 serviceId) external;

    /// @notice Withdraw the full bond. Requires:
    ///           - caller is the original bond staker
    ///           - 7 days elapsed since `requestWithdrawal`
    ///           - no open disputes for this service
    function withdrawBond(uint256 serviceId) external;

    /// @notice PactEscrow → arbiter notification when a dispute opens.
    ///         Custodies the disputer's bond. msg.sender must be the escrow.
    function openDispute(uint256 jobId, address disputer) external payable;

    /// @notice Re-verify the job's attestation against the CURRENT
    ///         service.signingAddress. On match: dispute fails, disputer
    ///         loses bond (90% to seller, 10% treasury). On mismatch:
    ///         seller bond slashed 70/20/10 (disputer/treasury/burn),
    ///         disputer's original bond refunded, job → Slashed.
    function arbitrate(uint256 jobId) external;

    /// @notice Active bond for `serviceId` plus the timestamp at which a
    ///         pending withdrawal becomes claimable. `withdrawableAt == 0`
    ///         means no withdrawal has been requested.
    function getBond(uint256 serviceId)
        external view returns (uint128 amount, uint64 withdrawableAt);

    /// @notice Inspect a dispute. Returned tuple is destructured (not the
    ///         struct) per PRD v0.4 §5.5 to keep the indexer surface stable
    ///         even if the internal struct gains fields in v0.2.
    function getDispute(uint256 jobId)
        external view returns (
            address disputer,
            uint128 disputeBond,
            uint64 openedAt,
            bool resolved
        );

    function MIN_BOND() external view returns (uint128);
}
