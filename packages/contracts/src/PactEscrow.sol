// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAttestationVerifier} from "./interfaces/IAttestationVerifier.sol";
import {IPactEscrow} from "./interfaces/IPactEscrow.sol";
import {IPactRegistry} from "./interfaces/IPactRegistry.sol";
import {IReputationVault} from "./interfaces/IReputationVault.sol";
import {ISlashingArbiter} from "./interfaces/ISlashingArbiter.sol";
import {PactRegistry} from "./PactRegistry.sol";

/// @title PactEscrow
/// @notice Buyer escrow + seller attestation settlement for the PACT protocol.
/// @dev    Verifier and registry are immutable; reputation vault is set at
///         construction (Step 2D will swap in the real impl). Treasury is
///         the protocol-fee sink; `sweepFees()` pulls accumulated fees.
///
///         Attack mitigations (PRD §14.1):
///           A1 (forged attestation):  AttestationVerifier.verify rejects
///                                     any signature whose ECDSA recovery
///                                     does not equal service.signingAddress.
///           A2 (replay):              `_usedChatIds` rejects any chatId
///                                     that has already settled a job.
///           A3 (provider mismatch):   deferred to Phase 2 hardening — would
///                                     require parsing the attestation text
///                                     and comparing parsed.providerType /
///                                     providerIdentity against
///                                     service.providerType /
///                                     providerIdentity. v0.1's signing-key
///                                     binding (A1) is sufficient because
///                                     0G mainnet today issues per-provider
///                                     keys; A3 is belt-and-suspenders.
contract PactEscrow is IPactEscrow, ReentrancyGuard {
    /*──────────────────────────── errors ───────────────────────────*/
    error JobNotFound();
    error NotPending();
    error NotSettled();
    error NotDisputed();
    error NotBuyer();
    error NotSeller();
    error ServiceInactive();
    error UnknownService();
    error ZeroAmount();
    error ZeroTimeout();
    error AttestationInvalid();
    error ChatIdReused();
    error NotExpired();
    error AlreadyExpired();
    error BondTooSmall();
    error TreasuryOnly();
    error ArbiterOnly();
    error NoFeesToSweep();

    /*──────────────────────────── constants ────────────────────────*/

    /// @notice Protocol fee in basis points. 500 = 5% of every settled job.
    uint16 public constant PROTOCOL_FEE_BPS = 500;
    uint16 private constant BPS_DENOMINATOR = 10_000;

    /// @notice Minimum bond a disputer must post. PRD §14.1 C1 mandates
    ///         "≥ 2× arbitration cost" — at PRD §5.6's ~85k gas estimate
    ///         and 4 gwei this is ~0.0006 $0G. We round generously up to
    ///         0.001 $0G (1e15 wei) to suppress spam.
    uint128 public constant DISPUTE_BOND = 1e15;

    /*──────────────────────────── deps ─────────────────────────────*/

    PactRegistry public immutable registry;
    IAttestationVerifier public immutable verifier;
    IReputationVault public immutable reputationVault;
    ISlashingArbiter public immutable arbiter;
    address public immutable treasury;

    /*──────────────────────────── state ────────────────────────────*/

    uint256 private _nextJobId = 1;
    mapping(uint256 => Job) private _jobs;
    mapping(bytes32 => bool) private _usedChatIds;

    /// @notice Accumulated protocol fees from settlements, awaiting sweep
    ///         to `treasury` via `sweepFees()`. Pull-pattern is more robust
    ///         than push to an arbitrary treasury contract (which could be
    ///         a multisig or upgradeable proxy).
    uint128 public protocolFeesPending;

    /// @notice Sum of `amount` across jobs in {Pending, Sealed, Attested}.
    ///         Mirrored as state so the invariant suite can read it cheaply
    ///         and the comparison stays O(1).
    uint128 public totalLockedEscrow;

    /*──────────────────────────── ctor ─────────────────────────────*/

    constructor(
        PactRegistry registry_,
        IAttestationVerifier verifier_,
        IReputationVault reputationVault_,
        ISlashingArbiter arbiter_,
        address treasury_
    ) {
        require(address(registry_) != address(0), "PactEscrow: zero registry");
        require(address(verifier_) != address(0), "PactEscrow: zero verifier");
        require(address(reputationVault_) != address(0), "PactEscrow: zero vault");
        require(address(arbiter_) != address(0), "PactEscrow: zero arbiter");
        require(treasury_ != address(0), "PactEscrow: zero treasury");

        registry = registry_;
        verifier = verifier_;
        reputationVault = reputationVault_;
        arbiter = arbiter_;
        treasury = treasury_;
    }

    /*──────────────────────────── createJob ────────────────────────*/

    /// @inheritdoc IPactEscrow
    function createJob(
        uint256 serviceId,
        bytes calldata encryptedInput,
        uint64 timeout
    ) external payable nonReentrant returns (uint256 jobId) {
        if (msg.value == 0) revert ZeroAmount();
        if (timeout == 0) revert ZeroTimeout();
        if (msg.value > type(uint128).max) revert ZeroAmount();

        IPactRegistry.Service memory svc = registry.getService(serviceId);
        if (!svc.active) revert ServiceInactive();
        if (svc.seller == address(0)) revert UnknownService();

        jobId = _nextJobId++;
        uint128 amount = uint128(msg.value);
        uint128 fee = uint128((uint256(amount) * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR);
        bytes32 inputCommitment = keccak256(encryptedInput);
        uint64 expiresAt;
        unchecked {
            expiresAt = uint64(block.timestamp) + timeout;
        }

        // Slot-by-slot write — keeps stack pressure manageable across the
        // wide Job struct + multiple params.
        Job storage job = _jobs[jobId];
        job.serviceId = serviceId;
        job.buyer = msg.sender;
        job.seller = svc.seller;
        job.amount = amount;
        job.protocolFee = fee;
        job.createdAt = uint64(block.timestamp);
        job.timeout = expiresAt;
        job.state = JobState.Pending;
        job.inputCommitment = inputCommitment;

        totalLockedEscrow += amount;

        emit JobCreated(jobId, serviceId, msg.sender, inputCommitment, amount, expiresAt);
    }

    /*──────────────────────────── submitAttestation ────────────────*/

    /// @inheritdoc IPactEscrow
    function submitAttestation(
        uint256 jobId,
        bytes32 outputRootHash,
        bytes32 chatId,
        bytes calldata attestationText,
        bytes calldata attestationSignature
    ) external nonReentrant {
        Job storage job = _mustGet(jobId);
        if (job.state != JobState.Pending) revert NotPending();
        if (job.seller != msg.sender) revert NotSeller();
        if (block.timestamp >= job.timeout) revert AlreadyExpired();
        if (_usedChatIds[chatId]) revert ChatIdReused();

        IPactRegistry.Service memory svc = registry.getService(job.serviceId);

        // Recover-and-compare via the canonical PACT verifier. A1 mitigation.
        bool ok = verifier.verify(attestationText, attestationSignature, svc.signingAddress);
        if (!ok) revert AttestationInvalid();

        // ── Effects (CEI) ──────────────────────────────────────────────
        _usedChatIds[chatId] = true;

        uint128 amount = job.amount;
        uint128 fee = job.protocolFee;
        uint128 sellerCut;
        unchecked {
            sellerCut = amount - fee; // fee ≤ amount by construction (5% of amount)
        }

        job.outputRootHash = outputRootHash;
        job.chatId = chatId;
        job.attestationText = attestationText;
        job.attestationSignature = attestationSignature;
        job.state = JobState.Settled;

        totalLockedEscrow -= amount;
        protocolFeesPending += fee;

        emit JobAttested(jobId, outputRootHash, chatId, svc.signingAddress);
        emit JobSettled(jobId, job.seller, sellerCut, fee);

        // ── Interactions ───────────────────────────────────────────────
        (bool sent,) = job.seller.call{value: sellerCut}("");
        require(sent, "PactEscrow: seller transfer failed");

        // Reputation update — the vault is allowed to be a stub in v0.1
        // (Step 2D ships the real impl); failure here would silently revert
        // a settled job, so we let it propagate.
        reputationVault.recordSettlement(job.serviceId, job.buyer, amount);
    }

    /*──────────────────────────── reclaimExpired ───────────────────*/

    /// @inheritdoc IPactEscrow
    function reclaimExpired(uint256 jobId) external nonReentrant {
        Job storage job = _mustGet(jobId);
        if (job.buyer != msg.sender) revert NotBuyer();
        if (job.state != JobState.Pending) revert NotPending();
        if (block.timestamp < job.timeout) revert NotExpired();

        uint128 amount = job.amount;
        job.state = JobState.Expired;
        totalLockedEscrow -= amount;

        emit JobExpired(jobId, job.buyer, amount);

        (bool sent,) = job.buyer.call{value: amount}("");
        require(sent, "PactEscrow: buyer refund failed");
    }

    /*──────────────────────────── dispute ──────────────────────────*/

    /// @inheritdoc IPactEscrow
    /// @dev   Only Settled jobs can be disputed (PRD §3.3 diagram:
    ///        SETTLED → DISPUTED). A 24h dispute window is mentioned as
    ///        "[optional]" in the diagram and is NOT enforced in v0.1 —
    ///        SlashingArbiter handles resolution timing. The disputer's
    ///        bond is forwarded immediately to SlashingArbiter via
    ///        `openDispute` so all bond custody (seller + disputer) is
    ///        in one contract.
    function dispute(uint256 jobId) external payable nonReentrant {
        if (msg.value < DISPUTE_BOND) revert BondTooSmall();
        Job storage job = _mustGet(jobId);
        if (job.state != JobState.Settled) revert NotSettled();

        job.state = JobState.Disputed;

        emit JobDisputed(jobId, msg.sender);

        // Forward disputer's bond + register the dispute. Done last so
        // that any revert in arbiter.openDispute rolls back the state
        // change above (CEI: state set, then external call).
        arbiter.openDispute{value: msg.value}(jobId, msg.sender);
    }

    /// @inheritdoc IPactEscrow
    function markSlashed(
        uint256 jobId,
        address slashedSeller,
        uint128 bondAmount,
        uint128 toDisputer,
        uint128 toTreasury,
        uint128 burned
    ) external {
        if (msg.sender != address(arbiter)) revert ArbiterOnly();
        Job storage job = _mustGet(jobId);
        if (job.state != JobState.Disputed) revert NotDisputed();
        job.state = JobState.Slashed;
        emit JobSlashed(jobId, slashedSeller, bondAmount, toDisputer, toTreasury, burned);
    }

    /*──────────────────────────── sweepFees ────────────────────────*/

    /// @notice Send accumulated protocol fees to the treasury. Pull pattern
    ///         keeps treasury safe against malicious recipient bytecode
    ///         that could revert per-settlement transfers.
    function sweepFees() external nonReentrant {
        if (msg.sender != treasury) revert TreasuryOnly();
        uint128 amt = protocolFeesPending;
        if (amt == 0) revert NoFeesToSweep();
        protocolFeesPending = 0;
        (bool sent,) = treasury.call{value: amt}("");
        require(sent, "PactEscrow: treasury sweep failed");
    }

    /*──────────────────────────── views ────────────────────────────*/

    function getJob(uint256 jobId) external view returns (Job memory) {
        Job memory job = _jobs[jobId];
        if (job.buyer == address(0)) revert JobNotFound();
        return job;
    }

    function nextJobId() external view returns (uint256) {
        return _nextJobId;
    }

    /// @notice The escrow currently held against this job. Returns 0 for
    ///         terminal states so the invariant suite can verify the
    ///         contract has fully released funds for that job.
    function jobEscrowBalance(uint256 jobId) external view returns (uint128) {
        Job memory job = _jobs[jobId];
        if (job.buyer == address(0)) return 0;
        if (
            job.state == JobState.Settled ||
            job.state == JobState.Expired ||
            job.state == JobState.Slashed ||
            job.state == JobState.Disputed
        ) {
            // Disputed jobs have already been settled (seller paid) — the
            // escrow for the *job* is gone. Disputer's bond lives at
            // SlashingArbiter, not here.
            return 0;
        }
        // Pending / Sealed / Attested still hold the original amount.
        return job.amount;
    }

    function isChatIdUsed(bytes32 chatId) external view returns (bool) {
        return _usedChatIds[chatId];
    }

    /*──────────────────────────── internals ────────────────────────*/

    function _mustGet(uint256 jobId) private view returns (Job storage) {
        Job storage job = _jobs[jobId];
        if (job.buyer == address(0)) revert JobNotFound();
        return job;
    }
}
