/**
 * PACT contract addresses on 0G mainnet.
 *
 * Populated by `script/DeployMainnet.s.sol` after broadcast — the deploy
 * script writes `deployments/mainnet.json` and a follow-up step propagates
 * the values here.
 *
 * Pre-deploy values are zero. Frontend / SDK code should treat zero
 * addresses as "deployment pending" and surface that to the user rather
 * than silently calling a non-existent contract.
 */

export const PACT_CHAIN_ID = 16661 as const;
export const PACT_CHAIN_NAME = "0G Mainnet" as const;
export const PACT_RPC_URL_PRIMARY = "https://evmrpc.0g.ai" as const;
export const PACT_EXPLORER_URL = "https://chainscan.0g.ai" as const;

export type PactContractName =
  | "AttestationVerifier"
  | "AgentNFT_implementation"
  | "AgentNFT_proxy"
  | "PactRegistry"
  | "ReputationVault"
  | "SlashingArbiter"
  | "PactEscrow";

export type Address = `0x${string}`;

export const PACT_ADDRESSES: Record<PactContractName, Address> = {
  AttestationVerifier:     "0x765C857B6764c90B0093Ea16f6103902665D0aa2",
  AgentNFT_implementation: "0x4EC0DCac00A274Fb69F54cAb62370b2c71989CE4",
  AgentNFT_proxy:          "0xe76dBE7FCf8c7F784b05DF88996bd63CA2c4d7D6",
  PactRegistry:            "0x152A5a433A6592df57d7F77B7B01eEE00C481C2d",
  ReputationVault:         "0x1574E42D7fF268384408430D5b76C88f37b8a72B",
  SlashingArbiter:         "0x324E5b2183134EB239C7E934438831a15abe7C00",
  PactEscrow:              "0xB2b762Df53294923d3eaD00d8118AD37388dD4aA",
};

export const PACT_CONFIG = {
  treasury:  "0xbF7EF900E2dB365455B91Fb133f78Fc70114Bf31" as Address,
  /** SlashingArbiter.MIN_BOND, in wei. 5 $0G (v0.1 hackathon calibration; was 100 $0G in v0.3, recalibrated 2026-05-08 in Phase 1 EXIT.1). */
  minBond:   "5000000000000000000",
  /** PactEscrow.PROTOCOL_FEE_BPS — 5%. */
  protocolFeeBps: 500,
  /** PactEscrow.DISPUTE_BOND, in wei. 0.001 $0G. */
  disputeBond: "1000000000000000",
  /** SlashingArbiter.WITHDRAWAL_DELAY, seconds. 7 days. */
  withdrawalDelaySeconds: 7 * 24 * 60 * 60,
} as const;

/**
 * Convenience guard: returns true once the deploy has populated real addresses.
 * Frontends should display a "deployment pending" banner when this is false.
 */
export function isPactDeployed(): boolean {
  const zero = "0x0000000000000000000000000000000000000000";
  return PACT_ADDRESSES.PactEscrow !== zero;
}
