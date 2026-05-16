// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {AgentNFT} from "../src/inft/AgentNFT.sol";
import {PactRegistry} from "../src/PactRegistry.sol";
import {IPactRegistry} from "../src/interfaces/IPactRegistry.sol";

contract PactRegistryTest is Test {
    AgentNFT internal agentNFT;
    PactRegistry internal registry;

    address internal admin = address(0xA11CE);
    address internal sellerA = address(0xB0B);
    address internal sellerB = address(0xCAFE);

    // Stand-in for the IERC7857DataVerifier the AgentNFT init insists on.
    // mintWithRole(address, string) does not call into the verifier, so any
    // non-zero address satisfies the init check.
    address internal verifierStub = address(0xDEAD);

    // Sample registration values mirroring the live G5 provider.
    bytes32 internal capabilityCodeReview = keccak256(bytes("code-review"));
    string  internal modelGlm5 = "zai-org/GLM-5-FP8";
    string  internal modelGlm5_1 = "zai-org/GLM-5.1-FP8";
    address internal providerG5 = 0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C;
    address internal providerG8 = 0x7DCFe6AEa70350C2090041524c9B4A9262DCe87D;
    address internal signerG5 = 0x4C1b546f5Fc11A9c2428eaFEd1D951Aa13C17ee8;
    address internal signerG8 = 0xA46EA4FC5889AD35A1487e1Ed04dCcfa872146B9;
    string  internal openrouter = "openrouter";
    string  internal centralized = "centralized";

    event ServiceRegistered(
        uint256 indexed serviceId,
        address indexed seller,
        uint256 inftTokenId,
        bytes32 capabilityHash,
        address signingAddress
    );
    event ServiceDelisted(uint256 indexed serviceId);
    event SigningAddressRotated(uint256 indexed serviceId, address oldKey, address newKey);

    function setUp() public virtual {
        vm.startPrank(admin);
        // AgentNFT is upgradeable — its constructor calls _disableInitializers,
        // so the implementation can never be initialized directly. Wrap it in
        // an ERC1967 proxy and treat the proxy as the AgentNFT instance.
        AgentNFT impl = new AgentNFT();
        bytes memory initData = abi.encodeCall(
            AgentNFT.initialize,
            ("PACT Agent INFT", "PACT", "ipfs://placeholder", verifierStub, admin)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        agentNFT = AgentNFT(address(proxy));

        registry = new PactRegistry(agentNFT);
        agentNFT.grantMinterRole(address(registry));
        vm.stopPrank();
    }

    // ────────────────────────────────────────────────────────────────────────
    // Unit tests
    // ────────────────────────────────────────────────────────────────────────

    function test_registerService_mintsINFT() public {
        vm.prank(sellerA);
        uint256 serviceId = registry.registerService(
            capabilityCodeReview,
            modelGlm5,
            providerG5,
            signerG5,
            openrouter,
            centralized,
            true,                  // targetSeparated — TeeTLS-semantic
            0.001 ether,
            8192,
            ""
        );

        assertEq(serviceId, 1, "first serviceId should be 1");
        IPactRegistry.Service memory svc = registry.getService(serviceId);
        assertEq(agentNFT.ownerOf(svc.inftTokenId), sellerA, "INFT minted to seller");
        assertEq(agentNFT.balanceOf(sellerA), 1, "seller holds exactly 1 INFT");
    }

    function test_registerService_storesAllFields() public {
        bytes memory metaURI = bytes("ipfs://bafyreibogus");
        uint128 price = 0.0042 ether;
        uint64 maxBytes = 16_384;

        vm.prank(sellerA);
        uint256 serviceId = registry.registerService(
            capabilityCodeReview,
            modelGlm5,
            providerG5,
            signerG5,
            openrouter,
            centralized,
            true,
            price,
            maxBytes,
            metaURI
        );

        IPactRegistry.Service memory svc = registry.getService(serviceId);
        assertEq(svc.seller, sellerA);
        assertEq(svc.capabilityHash, capabilityCodeReview);
        assertEq(svc.modelId, modelGlm5);
        assertEq(svc.providerAddress, providerG5);
        assertEq(svc.signingAddress, signerG5);
        assertEq(svc.providerIdentity, openrouter);
        assertEq(svc.providerType, centralized);
        assertTrue(svc.targetSeparated, "targetSeparated:true persisted");
        assertEq(svc.pricePerCall, price);
        assertEq(svc.maxInputBytes, maxBytes);
        assertEq(svc.registeredAt, uint64(block.timestamp));
        assertTrue(svc.active);
        assertEq(
            svc.modelCommitment,
            keccak256(abi.encodePacked(modelGlm5, providerG5)),
            "modelCommitment = keccak256(modelId || providerAddress)"
        );
        // AgentNFT's _incrementTokenId post-increments, so the first mint is
        // tokenId 0. Verify the token exists via ownership rather than a
        // ">0" check that would silently pass anything ≥ 0.
        assertEq(agentNFT.ownerOf(svc.inftTokenId), sellerA);
    }

    function test_registerService_TeeTLS_andTeeML() public {
        vm.prank(sellerA);
        uint256 idTLS = registry.registerService(
            capabilityCodeReview,
            modelGlm5,
            providerG5,
            signerG5,
            openrouter,
            centralized,
            true,                       // TeeTLS-semantic
            0.001 ether,
            8192,
            ""
        );

        // TeeML provider — providerIdentity / providerType empty per PRD §8.3
        // (no upstream API to identify when the model lives in the enclave).
        vm.prank(sellerB);
        uint256 idML = registry.registerService(
            capabilityCodeReview,
            modelGlm5_1,
            providerG8,
            signerG8,
            "",
            "",
            false,                      // TeeML-semantic
            0.001 ether,
            8192,
            ""
        );

        IPactRegistry.Service memory tls = registry.getService(idTLS);
        IPactRegistry.Service memory ml  = registry.getService(idML);

        assertTrue(tls.targetSeparated,  "TeeTLS service: targetSeparated true");
        assertFalse(ml.targetSeparated,  "TeeML  service: targetSeparated false");
        assertEq(tls.providerIdentity, openrouter);
        assertEq(ml.providerIdentity,  "");
        assertEq(tls.providerType, centralized);
        assertEq(ml.providerType,  "");
    }

    function test_rotateSigningAddress_onlySeller() public {
        vm.prank(sellerA);
        uint256 serviceId = registry.registerService(
            capabilityCodeReview,
            modelGlm5,
            providerG5,
            signerG5,
            openrouter,
            centralized,
            true,
            0.001 ether,
            8192,
            ""
        );

        address newSigner = address(0xBEEF);

        // Non-seller cannot rotate.
        vm.prank(sellerB);
        vm.expectRevert(PactRegistry.NotSeller.selector);
        registry.rotateSigningAddress(serviceId, newSigner);

        // Zero key rejected even from the seller.
        vm.prank(sellerA);
        vm.expectRevert(PactRegistry.ZeroSigningAddress.selector);
        registry.rotateSigningAddress(serviceId, address(0));

        // Seller can rotate; event carries old + new.
        vm.expectEmit(true, false, false, true, address(registry));
        emit SigningAddressRotated(serviceId, signerG5, newSigner);
        vm.prank(sellerA);
        registry.rotateSigningAddress(serviceId, newSigner);

        assertEq(registry.getService(serviceId).signingAddress, newSigner);
    }

    function test_delistService_emitsEvent() public {
        vm.prank(sellerA);
        uint256 serviceId = registry.registerService(
            capabilityCodeReview,
            modelGlm5,
            providerG5,
            signerG5,
            openrouter,
            centralized,
            true,
            0.001 ether,
            8192,
            ""
        );

        vm.expectEmit(true, false, false, false, address(registry));
        emit ServiceDelisted(serviceId);
        vm.prank(sellerA);
        registry.delistService(serviceId);

        assertFalse(registry.getService(serviceId).active, "active flag flipped to false");
    }

    function test_registerService_emitsEvent() public {
        bytes32 capability = capabilityCodeReview;

        // tokenId comes from AgentNFT — _incrementTokenId post-increments,
        // so the first mint returns id 0. serviceId starts at 1.
        vm.expectEmit(true, true, false, true, address(registry));
        emit ServiceRegistered(1, sellerA, 0, capability, signerG5);

        vm.prank(sellerA);
        registry.registerService(
            capability,
            modelGlm5,
            providerG5,
            signerG5,
            openrouter,
            centralized,
            true,
            0.001 ether,
            8192,
            ""
        );
    }

    function test_registerService_rejectsZeroAddresses() public {
        vm.startPrank(sellerA);

        vm.expectRevert(PactRegistry.ZeroProviderAddress.selector);
        registry.registerService(
            capabilityCodeReview, modelGlm5, address(0), signerG5,
            openrouter, centralized, true, 0.001 ether, 8192, ""
        );

        vm.expectRevert(PactRegistry.ZeroSigningAddress.selector);
        registry.registerService(
            capabilityCodeReview, modelGlm5, providerG5, address(0),
            openrouter, centralized, true, 0.001 ether, 8192, ""
        );

        vm.expectRevert(PactRegistry.EmptyModelId.selector);
        registry.registerService(
            capabilityCodeReview, "", providerG5, signerG5,
            openrouter, centralized, true, 0.001 ether, 8192, ""
        );

        vm.stopPrank();
    }

    function test_getSellerServices_listsAllForSeller() public {
        vm.startPrank(sellerA);
        uint256 a1 = registry.registerService(
            capabilityCodeReview, modelGlm5, providerG5, signerG5,
            openrouter, centralized, true, 0.001 ether, 8192, ""
        );
        uint256 a2 = registry.registerService(
            capabilityCodeReview, modelGlm5_1, providerG8, signerG8,
            "", "", false, 0.001 ether, 8192, ""
        );
        vm.stopPrank();
        vm.prank(sellerB);
        registry.registerService(
            capabilityCodeReview, modelGlm5, providerG5, signerG5,
            openrouter, centralized, true, 0.002 ether, 8192, ""
        );

        uint256[] memory aIds = registry.getSellerServices(sellerA);
        assertEq(aIds.length, 2, "seller A has 2 services");
        assertEq(aIds[0], a1);
        assertEq(aIds[1], a2);

        uint256[] memory bIds = registry.getSellerServices(sellerB);
        assertEq(bIds.length, 1, "seller B has 1 service");
    }
}
