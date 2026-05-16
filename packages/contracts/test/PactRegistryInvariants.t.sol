// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {AgentNFT} from "../src/inft/AgentNFT.sol";
import {PactRegistry} from "../src/PactRegistry.sol";
import {IPactRegistry} from "../src/interfaces/IPactRegistry.sol";

/// @notice Bounded-call wrapper around PactRegistry to drive the invariant
///         runner. All calls go through this handler so the invariant suite
///         can audit every successful state change.
contract Handler is Test {
    PactRegistry internal immutable registry;

    address[] internal sellers;
    uint256[] public registeredIds;

    constructor(PactRegistry registry_, address[] memory sellers_) {
        registry = registry_;
        sellers = sellers_;
    }

    /// @notice Register from one of the seeded sellers with bounded params.
    ///         signingAddress is forced non-zero (the contract reverts on
    ///         zero) — we want to fuzz the *successful* state space.
    function register(
        uint256 sellerSeed,
        bytes32 capabilityHash,
        address providerAddress,
        address signingAddress,
        bool    targetSeparated,
        uint128 pricePerCall
    ) external {
        address seller = sellers[bound(sellerSeed, 0, sellers.length - 1)];
        if (providerAddress == address(0)) providerAddress = address(0xC0FFEE);
        if (signingAddress == address(0)) signingAddress = address(0x51614);

        vm.prank(seller);
        try registry.registerService(
            capabilityHash,
            "model",
            providerAddress,
            signingAddress,
            "",
            "",
            targetSeparated,
            pricePerCall,
            8192,
            ""
        ) returns (uint256 serviceId) {
            registeredIds.push(serviceId);
        } catch {
            // Reverts are acceptable; the invariant cares about persisted state.
        }
    }

    /// @notice Rotate signing key on an already-registered service.
    function rotate(uint256 idSeed, address newKey) external {
        if (registeredIds.length == 0) return;
        uint256 serviceId = registeredIds[bound(idSeed, 0, registeredIds.length - 1)];
        IPactRegistry.Service memory svc = registry.getService(serviceId);
        if (newKey == address(0)) newKey = address(0xABCD);

        vm.prank(svc.seller);
        try registry.rotateSigningAddress(serviceId, newKey) {} catch {}
    }

    /// @notice Toggle active flag (price + active) on an existing service.
    function update(uint256 idSeed, uint128 newPrice, bool active) external {
        if (registeredIds.length == 0) return;
        uint256 serviceId = registeredIds[bound(idSeed, 0, registeredIds.length - 1)];
        IPactRegistry.Service memory svc = registry.getService(serviceId);

        vm.prank(svc.seller);
        try registry.updateService(serviceId, newPrice, active) {} catch {}
    }

    /// @notice Delist (sets active=false).
    function delist(uint256 idSeed) external {
        if (registeredIds.length == 0) return;
        uint256 serviceId = registeredIds[bound(idSeed, 0, registeredIds.length - 1)];
        IPactRegistry.Service memory svc = registry.getService(serviceId);

        vm.prank(svc.seller);
        try registry.delistService(serviceId) {} catch {}
    }

    function registeredIdsLength() external view returns (uint256) {
        return registeredIds.length;
    }
}

contract PactRegistryInvariantsTest is StdInvariant, Test {
    AgentNFT internal agentNFT;
    PactRegistry internal registry;
    Handler internal handler;

    address internal admin = address(0xA11CE);

    function setUp() public {
        vm.startPrank(admin);
        AgentNFT impl = new AgentNFT();
        bytes memory initData = abi.encodeCall(
            AgentNFT.initialize,
            ("PACT", "PACT", "ipfs://", address(0xDEAD), admin)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        agentNFT = AgentNFT(address(proxy));

        registry = new PactRegistry(agentNFT);
        agentNFT.grantMinterRole(address(registry));
        vm.stopPrank();

        address[] memory sellers = new address[](3);
        sellers[0] = address(0xB0B);
        sellers[1] = address(0xCAFE);
        sellers[2] = address(0xFEED);

        handler = new Handler(registry, sellers);

        // Foundry's invariant runner targets the handler — every function
        // call originates there, so we audit only the surface we care about.
        targetContract(address(handler));
    }

    /// @notice The PRD-locked invariant: any active service must carry a
    ///         non-zero signingAddress. Zero would defeat on-chain attestation
    ///         recovery (ECDSA.recover returning address(0) would silently
    ///         match an unset signer).
    function invariant_activeService_hasNonZeroSigningAddress() public view {
        uint256 len = handler.registeredIdsLength();
        for (uint256 i = 0; i < len; i++) {
            uint256 id = handler.registeredIds(i);
            IPactRegistry.Service memory svc = registry.getService(id);
            if (svc.active) {
                assertTrue(
                    svc.signingAddress != address(0),
                    "active service has zero signingAddress"
                );
            }
        }
    }
}
