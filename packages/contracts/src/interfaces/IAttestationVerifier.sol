// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IAttestationVerifier
/// @notice On-chain verifier for 0G Compute Direct-broker TEE attestations.
/// @dev Verbatim from MASTER_PRD v0.2 §5.3. Phase 0 G5 captured the
///      canonical signature payload from the live `/v1/proxy/signature/{chatId}`
///      endpoint; this interface keys off that exact shape.
interface IAttestationVerifier {
    /// @notice Recovers signer from an EIP-191 personal_sign over the attestation text.
    /// @param attestationText The canonical colon-separated payload as returned by
    ///        0G Compute /signature/{chatId}: "{contentHash}:{usageHash}:{providerType}:{providerIdentity}:{tlsCertFp}"
    /// @param signature 65-byte ECDSA r||s||v
    /// @return signer The recovered EVM address
    function recover(bytes calldata attestationText, bytes calldata signature)
        external
        pure
        returns (address signer);

    /// @notice Asserts the recovered signer matches the registered signingAddress.
    function verify(bytes calldata attestationText, bytes calldata signature, address expectedSigner)
        external
        pure
        returns (bool);

    /// @notice Parse the 5-field text into its components.
    function parseAttestationText(bytes calldata text)
        external
        pure
        returns (
            bytes32 contentHash,
            bytes32 usageHash,
            string memory providerType,
            string memory providerIdentity,
            bytes32 tlsCertFingerprint
        );
}
