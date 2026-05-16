// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAttestationVerifier} from "./interfaces/IAttestationVerifier.sol";
import {IPactEscrow} from "./interfaces/IPactEscrow.sol";
import {IPactRegistry} from "./interfaces/IPactRegistry.sol";
import {ISlashingArbiter} from "./interfaces/ISlashingArbiter.sol";
import {PactRegistry} from "./PactRegistry.sol";

/// @title SlashingArbiter
/// @notice Bond custody, dispute resolution, slash distribution.
/// @dev    PRD v0.3 §5.5. Three implementation decisions documented here
///         that aren't in the PRD spec body and should land alongside this
///         step's PRD amendment:
///
///         1. **Two-phase withdrawal.** PRD §3.3's seller-state diagram
///            mentions a 7-day delay implicitly ("DELISTING" state) but
///            doesn't spell out the mechanics. v0.1 ships
///            `requestWithdrawal` (sets timer) → 7 days → `withdrawBond`.
///            Mitigates §14.1 D1 (front-run withdrawal with dispute) by
///            giving disputers a window to dispute against the seller's
///            bond before it leaves the contract.
///
///         2. **Bond ownership = original registrant.** PRD §5.1 stores
///            `Service.seller` as the original registrant; INFT transfer
///            does NOT move the seller field (per Step 2D's operator/owner
///            split). Bond is the *operator's* commitment to honest
///            attestations, so it stays with the original registrant even
///            if the INFT (and reputation) transfers to a new owner.
///            Documented in `stakeBond` NatSpec.
///
///         3. **Arbitrate compares against CURRENT signingAddress.** PRD
///            §5.5 says "If signature now invalid (key rotated/revoked) OR
///            signer mismatch → slash." v0.1 honours that literally —
///            sellers MUST NOT rotate `signingAddress` while jobs are in
///            the dispute window (24h post-Settled), or any open dispute
///            slashes them. Phase 2 adds a per-service signing-address
///            history so legitimate rotations can be distinguished from
///            silent revocations.
contract SlashingArbiter is ISlashingArbiter, ReentrancyGuard {
    /*──────────────────────────── errors ───────────────────────────*/
    error BondTooSmall();
    error NotOriginalRegistrant();
    error NotBondPoster();
    error WithdrawalAlreadyRequested();
    error WithdrawalNotRequested();
    error WithdrawalDelayNotElapsed();
    error OpenDisputesPending();
    error EscrowOnly();
    error DisputeAlreadyOpen();
    error NoDisputeFound();
    error AlreadyArbitrated();
    error UnknownService();
    error ZeroTreasury();

    /*──────────────────────────── constants ────────────────────────*/

    /// @inheritdoc ISlashingArbiter
    /// @dev v0.1 hackathon calibration: 5 $0G. Sized for demo economics
    ///      (single-seller mainnet) where over-bonding the lone demo
    ///      seller would burn $0G with no sybil-resistance benefit.
    ///      Production calibration based on attestation cost +
    ///      sybil-resistance modeling against a populated provider set is
    ///      deferred to v0.2.
    uint128 public constant MIN_BOND = 5e18;
    uint64 public constant WITHDRAWAL_DELAY = 7 days;

    /// Slash distribution (PRD §5.5: "70% to disputer, 20% to protocol
    /// treasury, 10% burned"). Burn share is computed as the remainder so
    /// that any rounding dust stays in the burn bucket — never silently
    /// dropped, never overpaid.
    uint16 internal constant SLASH_DISPUTER_BPS = 7000;
    uint16 internal constant SLASH_TREASURY_BPS = 2000;
    uint16 internal constant BPS_DENOMINATOR = 10_000;

    /// Failed-dispute distribution: 90% to seller (compensation for the
    /// disruption), 10% to treasury (protocol fee on griefing).
    uint16 internal constant FAILED_DISPUTE_TREASURY_BPS = 1000;

    /*──────────────────────────── deps ─────────────────────────────*/

    PactRegistry public immutable registry;
    IPactEscrow public immutable escrow;
    IAttestationVerifier public immutable verifier;
    address public immutable treasury;

    /*──────────────────────────── state ────────────────────────────*/

    mapping(uint256 => uint128) private _bonds;
    mapping(uint256 => address) public bondPoster;
    mapping(uint256 => uint64) public withdrawalUnlockAt;
    mapping(uint256 => uint256) public openDisputesByService;
    mapping(uint256 => DisputeRecord) private _disputes;
    mapping(uint256 => bool) public arbitrated;

    /*──────────────────────────── ctor ─────────────────────────────*/

    constructor(
        PactRegistry registry_,
        IPactEscrow escrow_,
        IAttestationVerifier verifier_,
        address treasury_
    ) {
        require(address(registry_) != address(0), "SlashingArbiter: zero registry");
        require(address(escrow_)   != address(0), "SlashingArbiter: zero escrow");
        require(address(verifier_) != address(0), "SlashingArbiter: zero verifier");
        if (treasury_ == address(0)) revert ZeroTreasury();
        registry = registry_;
        escrow = escrow_;
        verifier = verifier_;
        treasury = treasury_;
    }

    /*──────────────────────────── stakeBond ────────────────────────*/

    /// @inheritdoc ISlashingArbiter
    /// @dev Caller MUST be the service's original registrant
    ///      (PactRegistry.Service.seller). INFT transfer does not move bond
    ///      authority — see contract NatSpec for rationale.
    function stakeBond(uint256 serviceId) external payable nonReentrant {
        IPactRegistry.Service memory svc = registry.getService(serviceId);
        if (svc.seller == address(0)) revert UnknownService();
        if (msg.sender != svc.seller) revert NotOriginalRegistrant();
        if (msg.value < MIN_BOND) revert BondTooSmall();

        bondPoster[serviceId] = svc.seller; // idempotent — same value on top-up
        _bonds[serviceId] += uint128(msg.value);

        emit BondStaked(serviceId, msg.sender, _bonds[serviceId]);
    }

    /*──────────────────────────── two-phase withdraw ───────────────*/

    /// @inheritdoc ISlashingArbiter
    function requestWithdrawal(uint256 serviceId) external {
        if (bondPoster[serviceId] != msg.sender) revert NotBondPoster();
        if (withdrawalUnlockAt[serviceId] != 0) revert WithdrawalAlreadyRequested();

        uint64 unlockAt = uint64(block.timestamp) + WITHDRAWAL_DELAY;
        withdrawalUnlockAt[serviceId] = unlockAt;
        emit WithdrawalRequested(serviceId, unlockAt);
    }

    /// @inheritdoc ISlashingArbiter
    function withdrawBond(uint256 serviceId) external nonReentrant {
        if (bondPoster[serviceId] != msg.sender) revert NotBondPoster();
        uint64 unlockAt = withdrawalUnlockAt[serviceId];
        if (unlockAt == 0) revert WithdrawalNotRequested();
        if (block.timestamp < unlockAt) revert WithdrawalDelayNotElapsed();
        if (openDisputesByService[serviceId] > 0) revert OpenDisputesPending();

        uint128 amount = _bonds[serviceId];
        _bonds[serviceId] = 0;
        bondPoster[serviceId] = address(0);
        withdrawalUnlockAt[serviceId] = 0;

        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "SlashingArbiter: withdraw transfer failed");
        emit BondWithdrawn(serviceId, msg.sender, amount);
    }

    /*──────────────────────────── openDispute ──────────────────────*/

    /// @inheritdoc ISlashingArbiter
    function openDispute(uint256 jobId, address disputer) external payable nonReentrant {
        if (msg.sender != address(escrow)) revert EscrowOnly();
        if (_disputes[jobId].disputer != address(0)) revert DisputeAlreadyOpen();

        IPactEscrow.Job memory job = escrow.getJob(jobId);
        _disputes[jobId] = DisputeRecord({
            disputer: disputer,
            bond: uint128(msg.value),
            openedAt: uint64(block.timestamp),
            resolved: false
        });
        ++openDisputesByService[job.serviceId];

        emit DisputeOpened(jobId, disputer, uint128(msg.value));
    }

    /*──────────────────────────── arbitrate ────────────────────────*/

    /// @inheritdoc ISlashingArbiter
    function arbitrate(uint256 jobId) external nonReentrant {
        DisputeRecord storage rec = _disputes[jobId];
        if (rec.disputer == address(0)) revert NoDisputeFound();
        if (arbitrated[jobId]) revert AlreadyArbitrated();

        IPactEscrow.Job memory job = escrow.getJob(jobId);
        IPactRegistry.Service memory svc = registry.getService(job.serviceId);

        bool valid = verifier.verify(
            job.attestationText,
            job.attestationSignature,
            svc.signingAddress
        );

        // Effects: mark resolved, decrement open-dispute counter.
        arbitrated[jobId] = true;
        rec.resolved = true;
        unchecked {
            // Counter was incremented in openDispute; non-zero by construction.
            --openDisputesByService[job.serviceId];
        }

        uint128 disputerBond = rec.bond;
        address disputer = rec.disputer;

        if (valid) {
            _resolveDisputeFailed(jobId, disputer, disputerBond, svc.seller);
        } else {
            _resolveSlash(jobId, disputer, disputerBond, job.serviceId, svc.seller);
        }
    }

    function _resolveDisputeFailed(
        uint256 jobId,
        address disputer,
        uint128 disputerBond,
        address seller
    ) private {
        // 90% to seller (compensation), 10% to treasury (griefing fee).
        // Treasury gets the remainder so any rounding dust lands there.
        uint128 toTreasury = uint128(
            (uint256(disputerBond) * FAILED_DISPUTE_TREASURY_BPS) / BPS_DENOMINATOR
        );
        uint128 toSeller;
        unchecked { toSeller = disputerBond - toTreasury; }

        if (toSeller > 0) {
            (bool ok1,) = seller.call{value: toSeller}("");
            require(ok1, "SlashingArbiter: seller transfer failed");
        }
        if (toTreasury > 0) {
            (bool ok2,) = treasury.call{value: toTreasury}("");
            require(ok2, "SlashingArbiter: treasury transfer failed");
        }

        emit DisputeFailed(jobId, disputer, toSeller, toTreasury);
    }

    function _resolveSlash(
        uint256 jobId,
        address disputer,
        uint128 disputerBond,
        uint256 serviceId,
        address slashedSeller
    ) private {
        uint128 sellerBond = _bonds[serviceId];

        // Compute the 70/20 shares first; burn is the remainder so any
        // rounding dust ends up burned (never lost, never overspent).
        uint128 toDisputer = uint128(
            (uint256(sellerBond) * SLASH_DISPUTER_BPS) / BPS_DENOMINATOR
        );
        uint128 toTreasury = uint128(
            (uint256(sellerBond) * SLASH_TREASURY_BPS) / BPS_DENOMINATOR
        );
        uint128 toBurn;
        unchecked { toBurn = sellerBond - toDisputer - toTreasury; }

        // Effects: zero the seller bond before any external calls.
        _bonds[serviceId] = 0;

        // Mark the job Slashed in PactEscrow with the full distribution
        // (PRD v0.4 §5.2 — JobSlashed event carries the four shares).
        // Done before transfers so a failed transfer in the
        // rare-trip-recipient case still records the slash on-chain.
        escrow.markSlashed(jobId, slashedSeller, sellerBond, toDisputer, toTreasury, toBurn);

        // Refund disputer's original bond …
        (bool ok0,) = disputer.call{value: disputerBond}("");
        require(ok0, "SlashingArbiter: disputer refund failed");

        // … then distribute the slashed seller bond.
        if (toDisputer > 0) {
            (bool ok1,) = disputer.call{value: toDisputer}("");
            require(ok1, "SlashingArbiter: disputer slash share failed");
        }
        if (toTreasury > 0) {
            (bool ok2,) = treasury.call{value: toTreasury}("");
            require(ok2, "SlashingArbiter: treasury slash share failed");
        }
        if (toBurn > 0) {
            // address(0) is a valid recipient for ETH; the value is
            // unrecoverable. Standard EVM burn pattern.
            (bool ok3,) = address(0).call{value: toBurn}("");
            require(ok3, "SlashingArbiter: burn failed");
        }

        emit Slashed(jobId, disputer, sellerBond, toDisputer, toTreasury, toBurn);
    }

    /*──────────────────────────── views ────────────────────────────*/

    /// @inheritdoc ISlashingArbiter
    function getBond(uint256 serviceId)
        external view returns (uint128 amount, uint64 withdrawableAt)
    {
        return (_bonds[serviceId], withdrawalUnlockAt[serviceId]);
    }

    /// @inheritdoc ISlashingArbiter
    function getDispute(uint256 jobId)
        external view returns (
            address disputer,
            uint128 disputeBond,
            uint64 openedAt,
            bool resolved
        )
    {
        DisputeRecord storage rec = _disputes[jobId];
        return (rec.disputer, rec.bond, rec.openedAt, rec.resolved);
    }
}
