// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IPactEscrow
/// @notice Job lifecycle, escrow custody, attestation submission, settlement.
/// @dev Verbatim from MASTER_PRD v0.3 §5.2. State machine per §3.3:
///      Pending → Settled (via submitAttestation+verify), or
///      Pending → Expired (via reclaimExpired), or
///      Settled → Disputed (via dispute, optional 24h window per PRD diagram).
///      Attested is a transient bucket reserved for future buyer-confirms-output
///      flow; v0.1 collapses Pending → Settled in one transition (the
///      JobAttested event still fires inside submitAttestation for indexer
///      observability).
interface IPactEscrow {
    enum JobState { Pending, Sealed, Attested, Settled, Expired, Disputed, Slashed }

    struct Job {
        uint256 serviceId;
        address buyer;
        address seller;
        uint128 amount;              // total escrowed
        uint128 protocolFee;         // taken on settlement
        uint64  createdAt;
        uint64  timeout;
        JobState state;
        bytes32 inputCommitment;     // keccak256(encryptedInput)
        bytes32 outputRootHash;      // 0G Storage rootHash, set on attestation
        bytes32 chatId;              // bytes32 of UUID from zg-res-key header (binds attestation to job)
        bytes   attestationText;     // the canonical 5-field colon-separated payload (signed by signingAddress)
        bytes   attestationSignature; // 65-byte ECDSA r||s||v
    }

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
    /// @dev Emitted when SlashingArbiter resolves a dispute against the seller.
    ///      Carries the full slash distribution so indexers + the demo UI can
    ///      surface "what got paid where" without correlating with
    ///      SlashingArbiter.Slashed. PRD v0.4 §5.2.
    event JobSlashed(
        uint256 indexed jobId,
        address indexed slashedSeller,
        uint128 bondAmount,
        uint128 toDisputer,
        uint128 toTreasury,
        uint128 burned
    );

    function createJob(
        uint256 serviceId,
        bytes calldata encryptedInput,
        uint64 timeout
    ) external payable returns (uint256 jobId);

    /// @notice Seller submits attestation. Contract verifies EIP-191 ECDSA recovery
    ///         over the canonical text recovers to service.signingAddress. On pass:
    ///         emit JobAttested → state=Settled → release escrow → increment reputation.
    function submitAttestation(
        uint256 jobId,
        bytes32 outputRootHash,
        bytes32 chatId,
        bytes calldata attestationText,
        bytes calldata attestationSignature
    ) external;

    function reclaimExpired(uint256 jobId) external;
    function dispute(uint256 jobId) external payable;

    /// @notice Transition the job to Slashed state. Callable only by the
    ///         linked SlashingArbiter when arbitrate() resolves against
    ///         the seller. Job must be in Disputed state.
    /// @param  jobId          The disputed job to mark Slashed.
    /// @param  slashedSeller  The seller whose bond was just slashed (for the event).
    /// @param  bondAmount     The seller bond size at slash time.
    /// @param  toDisputer     Slash share routed to the disputer (70%).
    /// @param  toTreasury     Slash share routed to the protocol treasury (20%).
    /// @param  burned         Slash share sent to address(0) — remainder, absorbs dust.
    /// @dev    PRD v0.4 §5.2. Arbiter computes the four shares; escrow only
    ///         transitions state and emits the event.
    function markSlashed(
        uint256 jobId,
        address slashedSeller,
        uint128 bondAmount,
        uint128 toDisputer,
        uint128 toTreasury,
        uint128 burned
    ) external;

    /// @notice Read a job by id. Reverts if the job does not exist.
    function getJob(uint256 jobId) external view returns (Job memory);
}
