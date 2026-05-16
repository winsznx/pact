// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {AgentNFT} from "../src/inft/AgentNFT.sol";
import {PactRegistry} from "../src/PactRegistry.sol";
import {IPactRegistry} from "../src/interfaces/IPactRegistry.sol";

/// @title SmokeTestMainnet
/// @notice Post-deploy sanity check — calls `registerService` against the
///         freshly-deployed mainnet PactRegistry using the live G5 fixture
///         data, then reads back the Service struct + verifies the seller's
///         INFT was minted. If this passes, the captured G5 mainnet bytes →
///         deployed mainnet contracts → INFT mint pipeline is proven
///         end-to-end on the actual chain (not just the test fork).
///
///         Reads `deployments/mainnet.json` for the registry + AgentNFT
///         addresses. Caller must hold `PACT_DEPLOYER_PRIVATE_KEY` and
///         have ~0.0015 $0G of headroom (registerService is ~342k gas at
///         4 gwei).
///
///         Run after Step 2G:
///           forge script script/SmokeTestMainnet.s.sol \
///             --rpc-url $PACT_RPC_URL --broadcast --slow
contract SmokeTestMainnet is Script {
    // Captured Phase 0 G5 fixture — same values that drive the unit + invariant
    // tests. Using these on mainnet reuses the proven happy-path inputs.
    address constant G5_PROVIDER       = 0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C;
    address constant CAPTURED_SIGNER   = 0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8;
    bytes32 constant CAPABILITY        = keccak256(bytes("smoke-test"));
    string  constant MODEL_ID          = "zai-org/GLM-5-FP8";
    string  constant PROVIDER_IDENTITY = "openrouter";
    string  constant PROVIDER_TYPE     = "centralized";

    function run() external {
        string memory manifest = vm.readFile("deployments/mainnet.json");
        require(
            vm.parseJsonUint(manifest, ".chainId") == 16661,
            "SmokeTestMainnet: not 0G mainnet"
        );
        address registryAddr = vm.parseJsonAddress(manifest, ".contracts.PactRegistry");
        address agentNFTAddr = vm.parseJsonAddress(manifest, ".contracts.AgentNFT_proxy");
        require(registryAddr != address(0), "registry zero");
        require(agentNFTAddr != address(0), "agentNFT zero");

        PactRegistry registry = PactRegistry(registryAddr);
        AgentNFT agentNFT = AgentNFT(agentNFTAddr);

        uint256 deployerPk = vm.envUint("PACT_DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);
        uint256 sellerINFTBalanceBefore = agentNFT.balanceOf(deployer);

        console2.log("=== PACT mainnet smoke test ===");
        console2.log("registry  :", registryAddr);
        console2.log("agentNFT  :", agentNFTAddr);
        console2.log("seller    :", deployer);
        console2.log("INFT bal before:", sellerINFTBalanceBefore);
        console2.log("");

        vm.startBroadcast(deployerPk);
        uint256 serviceId = registry.registerService(
            CAPABILITY,
            MODEL_ID,
            G5_PROVIDER,
            CAPTURED_SIGNER,
            PROVIDER_IDENTITY,
            PROVIDER_TYPE,
            true,                // targetSeparated (TeeTLS-semantic per G5-inspect)
            0.001 ether,         // pricePerCall
            8192,                // maxInputBytes
            ""                   // inftMetadataURI
        );
        vm.stopBroadcast();

        // Read back. These reads are static — no broadcast needed.
        IPactRegistry.Service memory svc = registry.getService(serviceId);
        uint256 sellerINFTBalanceAfter = agentNFT.balanceOf(deployer);

        require(svc.signingAddress == CAPTURED_SIGNER, "signer mismatch");
        require(svc.providerAddress == G5_PROVIDER, "provider mismatch");
        require(svc.targetSeparated, "targetSeparated mismatch");
        require(svc.active, "service not active");
        require(svc.seller == deployer, "seller mismatch");
        require(
            sellerINFTBalanceAfter == sellerINFTBalanceBefore + 1,
            "INFT not minted"
        );
        require(agentNFT.ownerOf(svc.inftTokenId) == deployer, "INFT owner mismatch");

        console2.log("=== Smoke test PASS ===");
        console2.log("serviceId       :", serviceId);
        console2.log("INFT tokenId    :", svc.inftTokenId);
        console2.log("seller          :", svc.seller);
        console2.log("signingAddress  :", svc.signingAddress);
        console2.log("providerAddress :", svc.providerAddress);
        console2.log("INFT bal after  :", sellerINFTBalanceAfter);
        console2.log("");
        console2.log("Captured G5 bytes -> mainnet contract -> INFT mint:  proven on-chain.");
    }
}
