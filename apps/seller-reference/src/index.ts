// Main entry. Loads config, opens the wallet, hands off to the watcher.
//
// Run via: pnpm --filter @pact/seller-reference run

import { ethers } from "ethers";

import { loadConfig } from "./config.ts";
import { log } from "./logger.ts";
import { runWatcher } from "./watcher.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const provider = new ethers.JsonRpcProvider(cfg.PACT_RPC_URL);
  const wallet = new ethers.Wallet(cfg.PACT_PRIVATE_KEY, provider);

  const balance = await provider.getBalance(wallet.address);
  const network = await provider.getNetwork();
  log.info("agent.boot", {
    seller: wallet.address,
    balanceOg: ethers.formatEther(balance),
    chainId: Number(network.chainId),
    rpc: cfg.PACT_RPC_URL,
  });

  await runWatcher(wallet, {
    serviceId: cfg.PACT_SERVICE_ID,
    providerAddress: cfg.PACT_BROKER_PROVIDER_ADDRESS,
    pollIntervalMs: cfg.PACT_POLL_INTERVAL_MS,
  });
}

main().catch((err) => {
  log.error("agent.fatal", {
    message: (err as Error).message,
    stack: (err as Error).stack?.split("\n").slice(0, 5).join("\n"),
  });
  process.exit(1);
});
