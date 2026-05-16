// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AgentNFT} from "./inft/AgentNFT.sol";
import {IPactRegistry} from "./interfaces/IPactRegistry.sol";

/// @title PactRegistry
/// @notice Seller registration for the PACT protocol. Mints an ERC-7857 INFT
///         to the seller (via the linked AgentNFT contract) and records the
///         service descriptor — including the canonical
///         `targetSeparated` flag (PRD v0.3 §5.1, §8.3) — for downstream
///         attestation verification by PactEscrow.
/// @dev    PactRegistry must hold MINTER_ROLE on the linked AgentNFT. Granted
///         out-of-band by the AgentNFT admin during deployment.
contract PactRegistry is IPactRegistry {
    error EmptyModelId();
    error ZeroProviderAddress();
    error ZeroSigningAddress();
    error UnknownService();
    error NotSeller();
    error ServiceInactive();

    AgentNFT public immutable agentNFT;

    uint256 private _nextServiceId = 1;
    mapping(uint256 => Service) private _services;

    constructor(AgentNFT agentNFT_) {
        require(address(agentNFT_) != address(0), "PactRegistry: zero AgentNFT");
        agentNFT = agentNFT_;
    }

    /// @inheritdoc IPactRegistry
    function registerService(
        bytes32 capabilityHash,
        string calldata modelId,
        address providerAddress,
        address signingAddress,
        string calldata providerIdentity,
        string calldata providerType,
        bool    targetSeparated,
        uint128 pricePerCall,
        uint64  maxInputBytes,
        bytes calldata inftMetadataURI
    ) external returns (uint256 serviceId) {
        if (bytes(modelId).length == 0) revert EmptyModelId();
        if (providerAddress == address(0)) revert ZeroProviderAddress();
        if (signingAddress == address(0)) revert ZeroSigningAddress();

        // Mint the seller's INFT. mintWithRole(address, string) is the
        // no-fee path reserved for trusted contracts; deployment grants this
        // contract MINTER_ROLE on the linked AgentNFT.
        uint256 tokenId = agentNFT.mintWithRole(
            msg.sender,
            string(abi.encodePacked(inftMetadataURI))
        );

        serviceId = _nextServiceId++;

        // Slot-by-slot storage write avoids the stack-too-deep error that
        // in-memory struct construction trips with this many fields/params.
        Service storage svc = _services[serviceId];
        svc.inftTokenId = tokenId;
        svc.seller = msg.sender;
        svc.capabilityHash = capabilityHash;
        svc.modelId = modelId;
        svc.modelCommitment = keccak256(abi.encodePacked(modelId, providerAddress));
        svc.providerAddress = providerAddress;
        svc.signingAddress = signingAddress;
        svc.providerIdentity = providerIdentity;
        svc.providerType = providerType;
        svc.targetSeparated = targetSeparated;
        svc.pricePerCall = pricePerCall;
        svc.maxInputBytes = maxInputBytes;
        svc.registeredAt = uint64(block.timestamp);
        svc.active = true;

        emit ServiceRegistered(serviceId, msg.sender, tokenId, capabilityHash, signingAddress);
    }

    /// @inheritdoc IPactRegistry
    function rotateSigningAddress(uint256 serviceId, address newSigningKey) external {
        if (newSigningKey == address(0)) revert ZeroSigningAddress();
        Service storage svc = _mustGet(serviceId);
        if (svc.seller != msg.sender) revert NotSeller();

        address oldKey = svc.signingAddress;
        svc.signingAddress = newSigningKey;
        emit SigningAddressRotated(serviceId, oldKey, newSigningKey);
    }

    /// @inheritdoc IPactRegistry
    function updateService(uint256 serviceId, uint128 newPrice, bool active) external {
        Service storage svc = _mustGet(serviceId);
        if (svc.seller != msg.sender) revert NotSeller();

        svc.pricePerCall = newPrice;
        svc.active = active;
        emit ServiceUpdated(serviceId, newPrice, active);
    }

    /// @inheritdoc IPactRegistry
    function delistService(uint256 serviceId) external {
        Service storage svc = _mustGet(serviceId);
        if (svc.seller != msg.sender) revert NotSeller();

        svc.active = false;
        emit ServiceDelisted(serviceId);
    }

    /// @inheritdoc IPactRegistry
    function getService(uint256 serviceId) external view returns (Service memory) {
        return _mustGetView(serviceId);
    }

    /// @inheritdoc IPactRegistry
    /// @dev Returns the set of services whose INFT is currently owned by `seller`.
    ///      This *follows INFT ownership*, not original registrant — the
    ///      "reputation accrues to the INFT, not the wallet" narrative
    ///      (PRD §3.2, §5.4) extends to listing: when an INFT transfers,
    ///      the buyer's `getSellerServices` immediately reflects the new
    ///      service. Two-pass O(N) over all registered services. v0.1
    ///      caller volume is hackathon-scale; if the registry crosses
    ///      ~10k services we paginate.
    ///
    ///      Note: operational mutators (`rotateSigningAddress`,
    ///      `updateService`, `delistService`) still gate on the *original*
    ///      registrant via `Service.seller`. The split — INFT owner gets
    ///      reputation + listing, original registrant retains operational
    ///      control — is deliberate for v0.1; a unified-owner model is a
    ///      Phase 2 design decision.
    function getSellerServices(address seller) external view returns (uint256[] memory) {
        uint256 total;
        unchecked { total = _nextServiceId - 1; }
        if (total == 0) return new uint256[](0);

        // Two-pass: count, then populate. Solidity views can't dynamically
        // grow a memory array, so the count pass is unavoidable.
        uint256 count;
        for (uint256 id = 1; id <= total; ++id) {
            if (_isOwnedBy(id, seller)) ++count;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 idx;
        for (uint256 id = 1; id <= total; ++id) {
            if (_isOwnedBy(id, seller)) {
                ids[idx++] = id;
            }
        }
        return ids;
    }

    function _isOwnedBy(uint256 serviceId, address candidate) private view returns (bool) {
        Service storage svc = _services[serviceId];
        if (svc.seller == address(0)) return false;
        // ownerOf reverts on burned tokens; the upstream AgentNFT does not
        // burn, but we guard regardless so a future burn extension doesn't
        // make this view DoS-able.
        try agentNFT.ownerOf(svc.inftTokenId) returns (address owner) {
            return owner == candidate;
        } catch {
            return false;
        }
    }

    function nextServiceId() external view returns (uint256) {
        return _nextServiceId;
    }

    function _mustGet(uint256 serviceId) private view returns (Service storage) {
        Service storage svc = _services[serviceId];
        if (svc.seller == address(0)) revert UnknownService();
        return svc;
    }

    function _mustGetView(uint256 serviceId) private view returns (Service memory) {
        Service memory svc = _services[serviceId];
        if (svc.seller == address(0)) revert UnknownService();
        return svc;
    }
}
