// Reads packages/contracts/deployments/mainnet.json and rewrites the
// addresses in packages/shared/src/contracts.ts to match.
//
// Run after Step 2G mainnet broadcast lands:
//   node packages/shared/scripts/populate-contracts.mjs
//
// Optionally point at a different manifest:
//   node packages/shared/scripts/populate-contracts.mjs <path-to-manifest>
//
// Idempotent. Re-run after any redeploy.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const DEFAULT_MANIFEST = join(
  REPO_ROOT,
  "packages",
  "contracts",
  "deployments",
  "mainnet.json",
);
const TARGET = join(HERE, "..", "src", "contracts.ts");

const manifestPath = resolve(process.argv[2] ?? DEFAULT_MANIFEST);

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`failed to read ${p}: ${e.message}`);
    process.exit(1);
  }
}

const manifest = readJson(manifestPath);
if (manifest.chainId !== 16661) {
  console.error(`expected chainId 16661 (0G mainnet), got ${manifest.chainId}`);
  process.exit(1);
}

const c = manifest.contracts ?? {};
const cfg = manifest.config ?? {};

const required = [
  "AttestationVerifier",
  "AgentNFT_implementation",
  "AgentNFT_proxy",
  "PactRegistry",
  "ReputationVault",
  "SlashingArbiter",
  "PactEscrow",
];
for (const name of required) {
  const addr = c[name];
  if (typeof addr !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    console.error(`manifest missing valid address for ${name}: ${addr}`);
    process.exit(1);
  }
}
if (typeof cfg.treasury !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(cfg.treasury)) {
  console.error(`manifest missing valid config.treasury: ${cfg.treasury}`);
  process.exit(1);
}

let src = readFileSync(TARGET, "utf8");

// Each contract address sits on its own line in PACT_ADDRESSES, formatted:
//   AttestationVerifier:     "0x...",
// Replace by name. Whitespace before the closing quote varies; the regex
// allows any number of spaces between `:` and the opening quote.
const replacements = required.map((name) => [name, c[name]]);
let changed = 0;
for (const [name, addr] of replacements) {
  const re = new RegExp(`(${name}:\\s+)"0x[0-9a-fA-F]{40}"`);
  if (!re.test(src)) {
    console.error(`could not find ${name} address line in contracts.ts`);
    process.exit(1);
  }
  const next = src.replace(re, `$1"${addr}"`);
  if (next !== src) changed++;
  src = next;
}

// Treasury sits in PACT_CONFIG with `as Address` after it.
const treasuryRe = /(treasury:\s+)"0x[0-9a-fA-F]{40}"\s+as\s+Address/;
if (!treasuryRe.test(src)) {
  console.error("could not find treasury line in contracts.ts");
  process.exit(1);
}
const beforeTreasury = src;
src = src.replace(treasuryRe, `$1"${cfg.treasury}" as Address`);
if (src !== beforeTreasury) changed++;

writeFileSync(TARGET, src);
console.log(`updated ${TARGET}`);
console.log(`  manifest:  ${manifestPath}`);
console.log(`  chainId:   ${manifest.chainId}`);
console.log(`  changed:   ${changed} address line(s)`);
console.log(`  deployer:  ${manifest.deployer}`);
console.log(`  treasury:  ${cfg.treasury}`);
