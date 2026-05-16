// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {AgentNFT} from "../src/inft/AgentNFT.sol";

/// @title VerifyMainnet
/// @notice Reads `deployments/mainnet.json` and emits the exact
///         `forge verify-contract` invocations needed to publish source
///         on `chainscan.0g.ai`. Foundry's verify-contract is a CLI command
///         (not a Solidity primitive), so this script's job is to print
///         the commands; the operator pipes stdout to bash or copies
///         them.
///
///         Run:
///           forge script script/VerifyMainnet.s.sol \
///             --rpc-url $PACT_RPC_URL
///
///         Then either:
///           - copy/paste each printed command, or
///           - rerun with `2>&1 | grep '^forge verify' | bash` to execute.
///
///         Verifier endpoint: chainscan.0g.ai is a Blockscout instance.
///         **Confirm `PACT_VERIFIER_URL` against 0G docs before running**
///         — the default below is the conventional Blockscout `/api` path
///         but has not been re-confirmed against the live endpoint as of
///         2026-05-08. If verification fails with HTTP errors, that's the
///         first thing to check.
contract VerifyMainnet is Script {
    string internal constant DEFAULT_VERIFIER_URL = "https://chainscan.0g.ai/api";
    string internal constant VERIFIER = "blockscout";

    function run() external view {
        string memory manifest = vm.readFile("deployments/mainnet.json");
        uint256 chainId = vm.parseJsonUint(manifest, ".chainId");
        require(chainId == 16661, "VerifyMainnet: not 0G mainnet");

        string memory verifierUrl = _envOrDefault("PACT_VERIFIER_URL", DEFAULT_VERIFIER_URL);

        console2.log("# PACT mainnet verification commands");
        console2.log("# chainId :", chainId);
        console2.log("# verifier:", verifierUrl);
        console2.log("#");
        console2.log("# pipe to bash to execute, or copy each line by hand:");
        console2.log("#   forge script script/VerifyMainnet.s.sol --rpc-url $PACT_RPC_URL 2>&1 \\");
        console2.log("#     | grep '^forge verify' | bash");
        console2.log("");

        _emitVerifyCommand(
            manifest,
            ".contracts.AttestationVerifier",
            "src/AttestationVerifier.sol:AttestationVerifier",
            verifierUrl,
            chainId,
            ""
        );
        _emitVerifyCommand(
            manifest,
            ".contracts.AgentNFT_implementation",
            "src/inft/AgentNFT.sol:AgentNFT",
            verifierUrl,
            chainId,
            ""
        );
        // The proxy is an ERC1967Proxy(impl, initData). The constructor
        // calldata MUST exactly match what the deploy script passed at
        // step 2. Reconstruct it here from the manifest (impl, verifier,
        // deployer) + the deploy-script constants.
        _emitProxyVerifyCommand(manifest, verifierUrl, chainId);
        _emitVerifyCommand(
            manifest,
            ".contracts.PactRegistry",
            "src/PactRegistry.sol:PactRegistry",
            verifierUrl,
            chainId,
            "" // ctor args constructed below
        );
        _emitVerifyCommand(
            manifest,
            ".contracts.ReputationVault",
            "src/ReputationVault.sol:ReputationVault",
            verifierUrl,
            chainId,
            ""
        );
        _emitVerifyCommand(
            manifest,
            ".contracts.SlashingArbiter",
            "src/SlashingArbiter.sol:SlashingArbiter",
            verifierUrl,
            chainId,
            ""
        );
        _emitVerifyCommand(
            manifest,
            ".contracts.PactEscrow",
            "src/PactEscrow.sol:PactEscrow",
            verifierUrl,
            chainId,
            ""
        );

        console2.log("");
        console2.log("# After all verifications land, propagate addresses to:");
        console2.log("#   packages/shared/src/contracts.ts");
        console2.log("#   apps/web/src/config/contracts.ts");
    }

    /// @dev Print a single `forge verify-contract` command. Constructor args
    ///      are passed as the trailing positional, empty string when none.
    ///      All five PACT contracts have constructor args; the operator
    ///      must encode them via `cast abi-encode` and substitute. We emit
    ///      a per-contract comment so the human knows what to fill in.
    function _emitVerifyCommand(
        string memory manifest,
        string memory jsonPath,
        string memory contractRef,
        string memory verifierUrl,
        uint256 chainId,
        string memory constructorArgs
    ) private view {
        address addr = vm.parseJsonAddress(manifest, jsonPath);
        string memory line = string.concat(
            "forge verify-contract ",
            vm.toString(addr),
            " ",
            contractRef,
            " --chain-id ",
            vm.toString(chainId),
            " --verifier ",
            VERIFIER,
            " --verifier-url ",
            verifierUrl,
            bytes(constructorArgs).length == 0
                ? string("")
                : string.concat(" --constructor-args ", constructorArgs),
            " --watch"
        );
        console2.log(line);
        console2.log(
            string.concat(
                "# ^ ", contractRef,
                "  (TODO: append --constructor-args $(cast abi-encode 'constructor(...)' ...) ",
                "if Blockscout reports 'constructor args mismatch')"
            )
        );
        console2.log("");
    }

    /// @dev Reconstruct the AgentNFT proxy's constructor calldata so the
    ///      operator can verify it on chainscan without hand-encoding.
    ///      The constants below MUST match DeployMainnet.s.sol exactly —
    ///      if those drift, this verification will mismatch.
    function _emitProxyVerifyCommand(
        string memory manifest,
        string memory verifierUrl,
        uint256 chainId
    ) private view {
        address proxyAddr    = vm.parseJsonAddress(manifest, ".contracts.AgentNFT_proxy");
        address implAddr     = vm.parseJsonAddress(manifest, ".contracts.AgentNFT_implementation");
        address verifierAddr = vm.parseJsonAddress(manifest, ".contracts.AttestationVerifier");
        address deployer     = vm.parseJsonAddress(manifest, ".deployer");

        // Match DeployMainnet.s.sol's AGENT_NFT_NAME / SYMBOL / STORAGE_URI.
        bytes memory initData = abi.encodeCall(
            AgentNFT.initialize,
            ("PACT Agent INFT", "PACT", "ipfs://pact-agent-inft-v1", verifierAddr, deployer)
        );
        bytes memory ctorArgs = abi.encode(implAddr, initData);

        console2.log(
            string.concat(
                "forge verify-contract ",
                vm.toString(proxyAddr),
                " node_modules/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
                " --chain-id ", vm.toString(chainId),
                " --verifier ", VERIFIER,
                " --verifier-url ", verifierUrl,
                " --constructor-args ", vm.toString(ctorArgs),
                " --watch"
            )
        );
        console2.log(
            "# ^ AgentNFT_proxy (ERC1967Proxy) -- constructor args encoded above"
        );
        console2.log("");
    }

    function _envOrDefault(string memory key, string memory dflt) private view returns (string memory) {
        try vm.envString(key) returns (string memory v) {
            if (bytes(v).length == 0) return dflt;
            return v;
        } catch {
            return dflt;
        }
    }
}
