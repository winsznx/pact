// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {AgentNFT} from "../src/inft/AgentNFT.sol";
import {AttestationVerifier} from "../src/AttestationVerifier.sol";
import {PactEscrow} from "../src/PactEscrow.sol";
import {PactRegistry} from "../src/PactRegistry.sol";
import {ReputationVault} from "../src/ReputationVault.sol";
import {SlashingArbiter} from "../src/SlashingArbiter.sol";
import {IPactEscrow} from "../src/interfaces/IPactEscrow.sol";

/// @title DeployMainnet
/// @notice Phase 1 Step 2F deploy script — implements PRD v0.4 §16.2's
///         finalized 8-step sequence including the predicted-CREATE-address
///         pattern that resolves the 3-way `vault.escrow ↔ arbiter.escrow
///         ↔ escrow.arbiter` immutable cycle.
///
///         Run:
///           # dry-run (simulate, no on-chain effect)
///           forge script script/DeployMainnet.s.sol --rpc-url $PACT_RPC_URL
///
///           # broadcast
///           forge script script/DeployMainnet.s.sol \
///             --rpc-url $PACT_RPC_URL --broadcast --slow
///
///         After broadcast, the script writes `deployments/mainnet.json`
///         carrying every deployed address + chainId + treasury config.
///         Run `script/VerifyMainnet.s.sol` next to publish source on
///         chainscan.0g.ai.
contract DeployMainnet is Script {
    /// @dev Storage URI baked into AgentNFT.initialize. Placeholder for v0.1
    ///      mainnet — a real ipfs:// pointer can be set later via the
    ///      AgentNFT admin path. Only affects metadata, not protocol logic.
    string internal constant AGENT_NFT_STORAGE_URI = "ipfs://pact-agent-inft-v1";

    string internal constant AGENT_NFT_NAME = "PACT Agent INFT";
    string internal constant AGENT_NFT_SYMBOL = "PACT";

    function run() external {
        uint256 deployerPk = vm.envUint("PACT_DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        address treasury = vm.envAddress("PACT_TREASURY");
        require(treasury != address(0), "DeployMainnet: PACT_TREASURY zero");

        console2.log("=== PACT mainnet deploy ===");
        console2.log("chainId   :", block.chainid);
        console2.log("deployer  :", deployer);
        console2.log("treasury  :", treasury);
        console2.log("balance   :", deployer.balance);
        console2.log("");

        vm.startBroadcast(deployerPk);

        // ───────────────────── Step 1: AttestationVerifier ────────────
        AttestationVerifier verifier = new AttestationVerifier();
        console2.log("1. AttestationVerifier  ", address(verifier));

        // ───────────────────── Step 2: AgentNFT impl + proxy ──────────
        // AgentNFT's constructor calls _disableInitializers, so the
        // implementation cannot be initialized directly — only the proxy
        // can. Initial AgentNFT verifier param is non-zero but otherwise
        // unused on the mintWithRole path; reuse our AttestationVerifier
        // address rather than introducing a separate verifier.
        AgentNFT agentNFTImpl = new AgentNFT();
        bytes memory initData = abi.encodeCall(
            AgentNFT.initialize,
            (
                AGENT_NFT_NAME,
                AGENT_NFT_SYMBOL,
                AGENT_NFT_STORAGE_URI,
                address(verifier),
                deployer
            )
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(agentNFTImpl), initData);
        AgentNFT agentNFT = AgentNFT(address(proxy));
        console2.log("2a. AgentNFT impl       ", address(agentNFTImpl));
        console2.log("2b. AgentNFT proxy      ", address(agentNFT));

        // ───────────────────── Step 3: PactRegistry ───────────────────
        PactRegistry registry = new PactRegistry(agentNFT);
        console2.log("3. PactRegistry         ", address(registry));

        // ───────────────────── Step 4: predict escrow CREATE address ──
        // Vault and arbiter both need the escrow address at construction;
        // escrow needs vault + arbiter at construction. Resolve the cycle
        // by predicting escrow's CREATE address from deployer.nonce + 2.
        // The next two `new` calls (vault, arbiter) burn nonces N and N+1;
        // escrow lands at N+2.
        uint64 nonce = vm.getNonce(deployer);
        address predictedEscrow = vm.computeCreateAddress(deployer, nonce + 2);
        console2.log("4. predictedEscrow      ", predictedEscrow);

        // ───────────────────── Step 5: ReputationVault ────────────────
        ReputationVault vault = new ReputationVault(predictedEscrow);
        console2.log("5. ReputationVault      ", address(vault));

        // ───────────────────── Step 6: SlashingArbiter ────────────────
        SlashingArbiter arbiter = new SlashingArbiter(
            registry,
            IPactEscrow(predictedEscrow),
            verifier,
            treasury
        );
        console2.log("6. SlashingArbiter      ", address(arbiter));

        // ───────────────────── Step 7: PactEscrow + sanity ────────────
        PactEscrow escrow = new PactEscrow(registry, verifier, vault, arbiter, treasury);
        require(address(escrow) == predictedEscrow, "DeployMainnet: deploy address mismatch");
        console2.log("7. PactEscrow           ", address(escrow));

        // ───────────────────── Step 8: grant minter role ──────────────
        agentNFT.grantMinterRole(address(registry));
        console2.log("8. AgentNFT.grantMinterRole(PactRegistry) sent");

        vm.stopBroadcast();

        // ───────────────────── Manifest ───────────────────────────────
        _writeManifest(
            deployer,
            treasury,
            address(verifier),
            address(agentNFTImpl),
            address(agentNFT),
            address(registry),
            address(vault),
            address(arbiter),
            address(escrow)
        );

        console2.log("");
        console2.log("=== Manifest written: deployments/mainnet.json ===");
    }

    function _writeManifest(
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
        // Build the nested `contracts` object first.
        string memory contractsKey = "contracts";
        vm.serializeAddress(contractsKey, "AttestationVerifier", verifier);
        vm.serializeAddress(contractsKey, "AgentNFT_implementation", agentNFTImpl);
        vm.serializeAddress(contractsKey, "AgentNFT_proxy", agentNFTProxy);
        vm.serializeAddress(contractsKey, "PactRegistry", registry);
        vm.serializeAddress(contractsKey, "ReputationVault", vault);
        vm.serializeAddress(contractsKey, "SlashingArbiter", arbiter);
        string memory contractsJson = vm.serializeAddress(contractsKey, "PactEscrow", escrow);

        // `config` object — keep MIN_BOND as a string because 100e18 wei
        // doesn't survive a JSON.parse round-trip via Number cleanly.
        string memory configKey = "config";
        vm.serializeAddress(configKey, "treasury", treasury);
        string memory configJson = vm.serializeString(
            configKey,
            "minBond",
            "100000000000000000000"
        );

        // Root object — chainId, timestamp, deployer, then the nested objs.
        string memory rootKey = "manifest";
        vm.serializeUint(rootKey, "chainId", block.chainid);
        vm.serializeUint(rootKey, "deployedAt", block.timestamp);
        vm.serializeAddress(rootKey, "deployer", deployer);
        vm.serializeString(rootKey, "contracts", contractsJson);
        string memory finalJson = vm.serializeString(rootKey, "config", configJson);

        vm.writeJson(finalJson, "deployments/mainnet.json");
    }
}
