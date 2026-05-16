// One-time setup: stake the seller's bond on SlashingArbiter for
// Service 1. Idempotent — re-running checks the on-chain bond balance
// and skips if already ≥ MIN_BOND.
//
// CLAUDE.md "Broadcasting on 0G mainnet" rules apply:
//   - Use legacy transactions, explicit gas price 4 gwei.
//   - Verify post-tx via on-chain reads, not just receipt parsing.

import { ethers } from "ethers";
import { PACT_ADDRESSES, PACT_CONFIG, SlashingArbiterAbi } from "@pact/shared";

import { loadConfig } from "./config.ts";
import { log } from "./logger.ts";

const GAS = { gasPrice: 4_000_000_000n, type: 0 as const };

async function main(): Promise<void> {
  const cfg = loadConfig();
  const provider = new ethers.JsonRpcProvider(cfg.PACT_RPC_URL);
  const wallet = new ethers.Wallet(cfg.PACT_PRIVATE_KEY, provider);

  const balance = await provider.getBalance(wallet.address);
  log.info("setup.start", {
    seller: wallet.address,
    balanceOg: ethers.formatEther(balance),
    serviceId: cfg.PACT_SERVICE_ID.toString(),
    minBondOg: ethers.formatEther(PACT_CONFIG.minBond),
  });

  const arbiter = new ethers.Contract(
    PACT_ADDRESSES.SlashingArbiter,
    SlashingArbiterAbi,
    wallet,
  );

  // Read existing bond — if already staked, no-op.
  const [amountWei, withdrawableAt] = (await arbiter.getBond(
    cfg.PACT_SERVICE_ID,
  )) as [bigint, bigint];
  if (amountWei >= BigInt(PACT_CONFIG.minBond)) {
    log.info("setup.bondAlreadyStaked", {
      serviceId: cfg.PACT_SERVICE_ID.toString(),
      amountWei: amountWei.toString(),
      amountOg: ethers.formatEther(amountWei),
      withdrawableAt: withdrawableAt.toString(),
    });
    log.info("setup.complete", { skipped: true });
    return;
  }

  // Sanity: enough $0G to cover bond + a little gas headroom.
  const minRequired = BigInt(PACT_CONFIG.minBond) + ethers.parseEther("0.05");
  if (balance < minRequired) {
    throw new Error(
      `insufficient balance: have ${ethers.formatEther(balance)} $0G, ` +
        `need ≥ ${ethers.formatEther(minRequired)} $0G (5 bond + 0.05 gas headroom)`,
    );
  }

  log.info("setup.staking", {
    serviceId: cfg.PACT_SERVICE_ID.toString(),
    valueWei: PACT_CONFIG.minBond,
  });
  const tx = await arbiter.stakeBond(cfg.PACT_SERVICE_ID, {
    value: BigInt(PACT_CONFIG.minBond),
    ...GAS,
  });
  log.info("setup.tx.sent", { txHash: tx.hash });

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`stakeBond reverted: tx ${tx.hash}`);
  }

  // Verify by reading back the bond, not by trusting the receipt parser.
  const [postAmount, postWithdrawableAt] = (await arbiter.getBond(
    cfg.PACT_SERVICE_ID,
  )) as [bigint, bigint];
  if (postAmount < BigInt(PACT_CONFIG.minBond)) {
    throw new Error(
      `post-tx bond read says ${postAmount} wei (expected ≥ ${PACT_CONFIG.minBond})`,
    );
  }

  log.info("setup.bondStaked", {
    serviceId: cfg.PACT_SERVICE_ID.toString(),
    txHash: tx.hash,
    amountWei: postAmount.toString(),
    amountOg: ethers.formatEther(postAmount),
    withdrawableAt: postWithdrawableAt.toString(),
  });
  log.info("setup.complete", { skipped: false });
}

main().catch((err) => {
  log.error("setup.fatal", {
    message: (err as Error).message,
    stack: (err as Error).stack?.split("\n").slice(0, 5).join("\n"),
  });
  process.exit(1);
});
