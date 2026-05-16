# INFT fork — provenance

Source: `https://github.com/0gfoundation/0g-agent-nft`
Commit: `b86e108a49bf3601bf57f1f0b3166dce2cb15928`
Captured: 2026-05-07 (G7 PASS)

## Files included (minimal closure for `AgentNFT.mintWithRole`)

- `AgentNFT.sol`
- `ERC7857Upgradeable.sol`
- `Utils.sol`
- `extensions/ERC7857AuthorizeUpgradeable.sol`
- `extensions/ERC7857CloneableUpgradeable.sol`
- `extensions/ERC7857IDataStorageUpgradeable.sol`
- `interfaces/IERC7857.sol`
- `interfaces/IERC7857Authorize.sol`
- `interfaces/IERC7857Cloneable.sol`
- `interfaces/IERC7857DataVerifier.sol`
- `interfaces/IERC7857Metadata.sol`

## Files deliberately excluded

- `AgentMarket.sol` + `interfaces/IAgentMarket.sol` — separate marketplace contract; PACT does not use it.
- `TeeVerifier.sol` + `verifiers/Verifier.sol` + `verifiers/base/BaseVerifier.sol` — TEE attestation verifier; superseded by PACT's `AttestationVerifier.sol`.
- `interfaces/IERC7857Legacy.sol` + `interfaces/IERC7857MetadataLegacy.sol` — legacy interfaces; not referenced by the included closure.
- `proxy/BeaconProxy.sol` + `proxy/UpgradeableBeacon.sol` — beacon proxy infrastructure; not used by v0.1 deployment (no upstream upgradeability needed for the hackathon).

## Modifications

None. Files copied byte-exact from upstream. Pragma `^0.8.20` kept; compiles under our pinned `0.8.24 + cancun`.
