// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {AttestationVerifier} from "../src/AttestationVerifier.sol";

/// @title AttestationVerifier — Phase 0 G5 ground-truth oracle
/// @notice Hardcoded fixture from MASTER_PRD v0.2 §15.1, captured 2026-05-07
///         from live mainnet provider 0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C
///         via `GET https://compute-network-1.integratenetwork.work/v1/proxy/signature/{chatId}`.
///         If `recover` returns CAPTURED_SIGNER, the on-chain attestation moat
///         matches the off-chain SDK behaviour bytes-for-bytes.
contract AttestationVerifierTest is Test {
    AttestationVerifier internal verifier;

    bytes constant CAPTURED_TEXT =
        "df0870f9b6a0bafc8223cebee0581160c6ea69876e57be3fa4e412450cd0b88e:0a2d1a40916f10253302e59bd1f1ea7dca6616fe4e816e3cd683310c5711eed6:centralized:openrouter:84c05f5412b2f6357c22c1fd3f9d345b9ac02e99254491a05b589b46570d3ba9";
    bytes constant CAPTURED_SIG =
        hex"99946cf42f441ae8756cc899f74054926c8b9d4ae5b570499783da23ae73393a647dc0f9a188159876d1ba52b42bdc0b837ccaaf0ccf79b93449a16b1f9fab831c";
    // EIP-55 checksummed form of the live `signing_address` field. PRD §15.1
    // uses a mixed-case form that fails EIP-55; same 20 address bytes, different
    // casing only. Fixed here, queue PRD edit.
    address constant CAPTURED_SIGNER = 0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8;

    function setUp() public {
        verifier = new AttestationVerifier();
    }

    /// @notice The moat. EIP-191 personal_sign recovery against the captured
    ///         (text, signature) tuple must yield the live `signing_address`.
    function test_recoverMatchesLiveSigner() public view {
        address recovered = verifier.recover(CAPTURED_TEXT, CAPTURED_SIG);
        assertEq(recovered, CAPTURED_SIGNER);
    }
}
