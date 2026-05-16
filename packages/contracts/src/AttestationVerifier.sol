// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {IAttestationVerifier} from "./interfaces/IAttestationVerifier.sol";

/// @title AttestationVerifier
/// @notice Recovers and verifies 0G Compute Direct-broker TEE attestation signatures.
/// @dev Reference impl per MASTER_PRD v0.2 §5.3. Empirically validated against the
///      Phase 0 G5 captured tuple — see test/AttestationVerifier.t.sol.
contract AttestationVerifier is IAttestationVerifier {
    error InvalidLength();
    error MissingSeparator();
    error InvalidHexChar();

    /// @inheritdoc IAttestationVerifier
    function recover(bytes calldata attestationText, bytes calldata signature)
        external
        pure
        returns (address)
    {
        return _recover(attestationText, signature);
    }

    /// @inheritdoc IAttestationVerifier
    function verify(bytes calldata attestationText, bytes calldata signature, address expectedSigner)
        external
        pure
        returns (bool)
    {
        return _recover(attestationText, signature) == expectedSigner;
    }

    /// @inheritdoc IAttestationVerifier
    function parseAttestationText(bytes calldata text)
        external
        pure
        returns (
            bytes32 contentHash,
            bytes32 usageHash,
            string memory providerType,
            string memory providerIdentity,
            bytes32 tlsCertFingerprint
        )
    {
        // Layout: <64 hex>:<64 hex>:<providerType>:<providerIdentity>:<64 hex>
        // Minimum length: 64 + 1 + 64 + 1 + 1 + 1 + 1 + 1 + 64 = 198
        uint256 len = text.length;
        if (len < 198) revert InvalidLength();

        contentHash = _hexToBytes32(text[0:64]);
        if (text[64] != ":") revert MissingSeparator();

        usageHash = _hexToBytes32(text[65:129]);
        if (text[129] != ":") revert MissingSeparator();

        uint256 sep3 = _findColon(text, 130);
        providerType = string(text[130:sep3]);

        uint256 sep4 = _findColon(text, sep3 + 1);
        providerIdentity = string(text[sep3 + 1:sep4]);

        if (len - sep4 - 1 != 64) revert InvalidLength();
        tlsCertFingerprint = _hexToBytes32(text[sep4 + 1:len]);
    }

    function _recover(bytes calldata attestationText, bytes calldata signature) private pure returns (address) {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(attestationText);
        return ECDSA.recover(digest, signature);
    }

    function _findColon(bytes calldata text, uint256 start) private pure returns (uint256) {
        uint256 len = text.length;
        for (uint256 i = start; i < len; ++i) {
            if (text[i] == ":") return i;
        }
        revert MissingSeparator();
    }

    function _hexToBytes32(bytes calldata hex64) private pure returns (bytes32 result) {
        if (hex64.length != 64) revert InvalidLength();
        uint256 acc;
        for (uint256 i = 0; i < 64; ++i) {
            acc = (acc << 4) | _hexNibble(uint8(hex64[i]));
        }
        result = bytes32(acc);
    }

    function _hexNibble(uint8 c) private pure returns (uint256) {
        unchecked {
            if (c >= 0x30 && c <= 0x39) return c - 0x30;
            if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
            if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
        }
        revert InvalidHexChar();
    }
}
