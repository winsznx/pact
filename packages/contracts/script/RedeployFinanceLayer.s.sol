// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {PactEscrow} from "../src/PactEscrow.sol";
import {PactRegistry} from "../src/PactRegistry.sol";
import {ReputationVault} from "../src/ReputationVault.sol";
import {SlashingArbiter} from "../src/SlashingArbiter.sol";
import {IAttestationVerifier} from "../src/interfaces/IAttestationVerifier.sol";
import {IPactEscrow} from "../src/interfaces/IPactEscrow.sol";

/// @title RedeployFinanceLayer
/// @notice Phase 1 EXIT.1 — partial redeploy after MIN_BOND recalibration.
///         Replaces ReputationVault + SlashingArbiter + PactEscrow only.
///         AttestationVerifier, AgentNFT (impl + proxy), and PactRegistry
///         are reused from the existing `deployments/mainnet.json`.
///
///         Why this works:
///           - PactRegistry stores `Service.signingAddress` and has no
///             dependency on Escrow/Vault/Arbiter — Service 1 (the
///             smoke-tested demo seller) remains valid against the new
///             PactEscrow.
///           - AgentNFT proxy + minter-role grant are untouched —
///             PactRegistry retains MINTER_ROLE.
///           - ReputationVault and SlashingArbiter are start-empty by
///             design (vault has no prior settlements; arbiter has no
///             open disputes), so dropping the old ones costs us nothing.
///
///         What gets orphaned on chain:
///           - Old ReputationVault, SlashingArbiter, PactEscrow stay
///             deployed but unreferenced. They're inert: no one calls
///             them because the registry now points downstream actors at
///             the new addresses (via the populated contracts.ts after
///             Tim runs populate-contracts.mjs against the new manifest).
///
///         Run:
///           # dry-run
///           forge script script/RedeployFinanceLayer.s.sol \
///             --rpc-url $PACT_RPC_URL
///
///           # broadcast (Tim only, after reviewing the dry-run)
///           forge script script/RedeployFinanceLayer.s.sol \
///             --rpc-url $PACT_RPC_URL --broadcast --slow
///
///         Output: `deployments/mainnet.redeploy.json` — NOT overwriting
///         `mainnet.json`. Operator promotes manually after review.
contract RedeployFinanceLayer is Script {
    function run() external {
        string memory existing = vm.readFile("deployments/mainnet.json");
        require(
            vm.parseJsonUint(existing, ".chainId") == 16661,
            "RedeployFinanceLayer: existing manifest not 0G mainnet"
        );

        address verifierAddr = vm.parseJsonAddress(existing, ".contracts.AttestationVerifier");
        address registryAddr = vm.parseJsonAddress(existing, ".contracts.PactRegistry");
        address agentNFTImpl = vm.parseJsonAddress(existing, ".contracts.AgentNFT_implementation");
        address agentNFTProxy = vm.parseJsonAddress(existing, ".contracts.AgentNFT_proxy");
        address treasury = vm.parseJsonAddress(existing, ".config.treasury");

        require(verifierAddr != address(0), "verifier zero");
        require(registryAddr != address(0), "registry zero");
        require(treasury != address(0), "treasury zero");

        uint256 deployerPk = vm.envUint("PACT_DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        console2.log("=== PACT finance-layer redeploy ===");
        console2.log("chainId            :", block.chainid);
        console2.log("deployer           :", deployer);
        console2.log("deployer.nonce     :", vm.getNonce(deployer));
        console2.log("deployer.balance   :", deployer.balance);
        console2.log("");
        console2.log("CARRIED OVER from mainnet.json:");
        console2.log("  AttestationVerifier      :", verifierAddr);
        console2.log("  AgentNFT_implementation  :", agentNFTImpl);
        console2.log("  AgentNFT_proxy           :", agentNFTProxy);
        console2.log("  PactRegistry             :", registryAddr);
        console2.log("  treasury                 :", treasury);
        console2.log("");

        IAttestationVerifier verifier = IAttestationVerifier(verifierAddr);
        PactRegistry registry = PactRegistry(registryAddr);

        vm.startBroadcast(deployerPk);

        // Same 3-way cycle resolution as the original deploy: vault and
        // arbiter both predict escrow at deployer.nonce + 2; escrow lands
        // at exactly that address when it's the third CREATE in this tx
        // sequence.
        uint64 nonce = vm.getNonce(deployer);
        address predictedEscrow = vm.computeCreateAddress(deployer, nonce + 2);
        console2.log("predictedEscrow @ nonce+2:", predictedEscrow);
        console2.log("");

        ReputationVault vault = new ReputationVault(predictedEscrow);
        console2.log("1. ReputationVault (new) :", address(vault));

        SlashingArbiter arbiter = new SlashingArbiter(
            registry,
            IPactEscrow(predictedEscrow),
            verifier,
            treasury
        );
        console2.log("2. SlashingArbiter (new) :", address(arbiter));
        console2.log("   MIN_BOND               :", arbiter.MIN_BOND());

        PactEscrow escrow = new PactEscrow(registry, verifier, vault, arbiter, treasury);
        require(
            address(escrow) == predictedEscrow,
            "RedeployFinanceLayer: escrow address mismatch"
        );
        console2.log("3. PactEscrow (new)      :", address(escrow));

        vm.stopBroadcast();

        _writeRedeployManifest(
            deployer,
            treasury,
            verifierAddr,
            agentNFTImpl,
            agentNFTProxy,
            registryAddr,
            address(vault),
            address(arbiter),
            address(escrow)
        );

        console2.log("");
        console2.log("=== Redeploy manifest written: deployments/mainnet.redeploy.json ===");
        console2.log("Tim: review, then promote to mainnet.json + re-run");
        console2.log("     `node packages/shared/scripts/populate-contracts.mjs`");
    }

    function _writeRedeployManifest(
        address deployer,
        address treasury,
        address verifier,
        address agentNFTImpl,
        address agentNFTProxy,
        address registry,
        address vault,
        address arbiter,
        address escrow
    ) private {
        // Mirror mainnet.json shape so populate-contracts.mjs can consume
        // it directly (after Tim renames mainnet.redeploy.json to
        // mainnet.json) — same 7 contract keys, same config fields.
        string memory contractsKey = "contracts";
        vm.serializeAddress(contractsKey, "AttestationVerifier", verifier);
        vm.serializeAddress(contractsKey, "AgentNFT_implementation", agentNFTImpl);
        vm.serializeAddress(contractsKey, "AgentNFT_proxy", agentNFTProxy);
        vm.serializeAddress(contractsKey, "PactRegistry", registry);
        vm.serializeAddress(contractsKey, "ReputationVault", vault);
        vm.serializeAddress(contractsKey, "SlashingArbiter", arbiter);
        string memory contractsJson = vm.serializeAddress(contractsKey, "PactEscrow", escrow);

        string memory configKey = "config";
        vm.serializeAddress(configKey, "treasury", treasury);
        // 5 $0G — matches the recalibrated MIN_BOND constant in
        // SlashingArbiter.sol. Phase 2 calibration TBD.
        string memory configJson = vm.serializeString(
            configKey,
            "minBond",
            "5000000000000000000"
        );

        string memory rootKey = "manifest";
        vm.serializeUint(rootKey, "chainId", block.chainid);
        vm.serializeUint(rootKey, "deployedAt", block.timestamp);
        vm.serializeAddress(rootKey, "deployer", deployer);
        vm.serializeString(rootKey, "redeploy", "phase-1-exit-1-min-bond-5og");
        vm.serializeString(rootKey, "contracts", contractsJson);
        string memory finalJson = vm.serializeString(rootKey, "config", configJson);

        vm.writeJson(finalJson, "deployments/mainnet.redeploy.json");
    }
}
