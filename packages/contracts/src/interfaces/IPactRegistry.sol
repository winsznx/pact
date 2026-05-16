// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IPactRegistry
/// @notice Seller registration, capability listing, INFT minting wrapper for the PACT protocol.
/// @dev Verbatim from MASTER_PRD v0.3 §5.1. The struct, events, and functions
///      below MUST match the spec — drift = stop, surface, decide which to update.
///
///      Pre-flight discovery: signingAddress, providerType, providerIdentity,
///      and targetSeparated are all readable from a single
///      `inference.listService()` call. Index 9 of every entry carries the TEE
///      proxy's signing key; index 8 carries `additionalInfo` whose
///      ProviderType / ProviderIdentity / TargetSeparated populate the
///      corresponding params verbatim. Sellers do NOT need an inference
///      bootstrap to register.
///
///      `targetSeparated` is the canonical TeeTLS / TeeML discriminator on
///      0G mainnet — DO NOT trust the `verifiability` label from the G3
///      Router catalog (the same provider can be tagged "TeeTLS" by the
///      Router catalog and "TeeML" by `listService()`).
interface IPactRegistry {
    struct Service {
        uint256 inftTokenId;            // ERC-7857 token ID (in linked AgentNFT contract)
        address seller;
        bytes32 capabilityHash;         // keccak256(capabilityTag) e.g. "code-review"
        string  modelId;                // e.g. "zai-org/GLM-5-FP8"
        bytes32 modelCommitment;        // keccak256(modelId || providerAddress)
        address providerAddress;        // 0G Compute provider EVM address (e.g. 0xd9966e13...)
        address signingAddress;         // TEE proxy's signing key (e.g. 0x4C1b546f...)
        string  providerIdentity;       // upstream LLM provider name e.g. "openrouter"; empty for TargetSeparated:false
        string  providerType;           // upstream service type, e.g. "centralized"; empty for TargetSeparated:false
        bool    targetSeparated;        // canonical TeeTLS/TeeML discriminator; see contract NatSpec
        uint128 pricePerCall;           // wei of $0G
        uint64  maxInputBytes;
        uint64  registeredAt;
        bool    active;
    }

    event ServiceRegistered(
        uint256 indexed serviceId,
        address indexed seller,
        uint256 inftTokenId,
        bytes32 capabilityHash,
        address signingAddress
    );
    event ServiceUpdated(uint256 indexed serviceId, uint128 newPrice, bool active);
    event ServiceDelisted(uint256 indexed serviceId);
    event SigningAddressRotated(uint256 indexed serviceId, address oldKey, address newKey);

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
    ) external returns (uint256 serviceId);

    function rotateSigningAddress(uint256 serviceId, address newSigningKey) external;
    function updateService(uint256 serviceId, uint128 newPrice, bool active) external;
    function delistService(uint256 serviceId) external;

    function getService(uint256 serviceId) external view returns (Service memory);
    function getSellerServices(address seller) external view returns (uint256[] memory);
}
