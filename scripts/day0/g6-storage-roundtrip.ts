/**
 * Gate G6 — 0G Storage roundtrip via @0gfoundation/0g-storage-ts-sdk.
 *
 * NOTE — PRD drift: MASTER_PRD references `@0glabs/0g-ts-sdk`. The
 * published package is `@0gfoundation/0g-storage-ts-sdk` (latest 1.2.9;
 * upstream repo github.com/0glabs/0g-ts-sdk). We use the correct package
 * here and have flagged the drift in docs/AGENT_PROGRESS.md.
 *
 * Flow per the SDK source:
 *   const indexer = new Indexer(indexerUrl);
 *   const file = new MemData(buffer);                // 1KB in memory
 *   const [tree] = await file.merkleTree();
 *   const expectedRoot = tree.rootHash();
 *   const [{ rootHash, txHash }, err] = await indexer.upload(file, evmRpc, signer);
 *   const err = await indexer.download(rootHash, outPath, true);
 *
 * Pass criteria (PRD §21): blob retrievable by root_hash with bytes intact.
 */

import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { loadEnv } from "./lib/env.ts";
import { runGate } from "./lib/output.ts";

await runGate("g6-storage-roundtrip", async () => {
  const env = loadEnv(["PACT_PRIVATE_KEY"]);

  const provider = new ethers.JsonRpcProvider(env.PACT_RPC_URL);
  const wallet = new ethers.Wallet(env.PACT_PRIVATE_KEY!, provider);
  const balance = await provider.getBalance(wallet.address);

  // 1KB payload: 16-byte marker + 1008 random bytes.
  const marker = Buffer.from("PACT::G6::v1::", "utf8");
  const payload = Buffer.concat([marker, randomBytes(1024 - marker.length)]);

  const indexer = new Indexer(env.PACT_STORAGE_INDEXER_URL);
  const file = new MemData(payload);

  // Compute expected root before upload so we can assert post-upload.
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr || !tree) {
    return {
      status: "FAIL" as const,
      summary: `merkleTree() failed: ${treeErr?.message ?? "no tree returned"}`,
      data: {
        wallet: wallet.address,
        balanceWei: balance.toString(),
        payloadBytes: payload.length,
        treeErr: treeErr?.message ?? null,
      },
    };
  }
  const expectedRoot = tree.rootHash();

  // Upload.
  const uploadStart = Date.now();
  const [uploadResult, uploadErr] = await indexer.upload(
    file,
    env.PACT_RPC_URL,
    wallet,
  );
  const uploadMs = Date.now() - uploadStart;
  if (uploadErr || !uploadResult) {
    return {
      status: "FAIL" as const,
      summary: `upload failed: ${uploadErr?.message ?? "no result"}`,
      data: {
        wallet: wallet.address,
        balanceWei: balance.toString(),
        payloadBytes: payload.length,
        expectedRoot,
        uploadErr: uploadErr?.message ?? null,
        uploadMs,
      },
    };
  }

  // Single-file uploads return { rootHash, txHash, txSeq }.
  const rootHash =
    "rootHash" in uploadResult
      ? (uploadResult as { rootHash: string }).rootHash
      : Array.isArray((uploadResult as { rootHashes?: string[] }).rootHashes)
        ? (uploadResult as { rootHashes: string[] }).rootHashes[0]!
        : null;
  const txHash =
    "txHash" in uploadResult
      ? (uploadResult as { txHash: string }).txHash
      : Array.isArray((uploadResult as { txHashes?: string[] }).txHashes)
        ? (uploadResult as { txHashes: string[] }).txHashes[0]!
        : null;
  const txSeq =
    "txSeq" in uploadResult
      ? (uploadResult as { txSeq: number }).txSeq
      : Array.isArray((uploadResult as { txSeqs?: number[] }).txSeqs)
        ? (uploadResult as { txSeqs: number[] }).txSeqs[0]
        : null;

  if (!rootHash) {
    return {
      status: "FAIL" as const,
      summary: "upload returned no rootHash; cannot verify retrieval",
      data: {
        wallet: wallet.address,
        payloadBytes: payload.length,
        expectedRoot,
        uploadResult,
        uploadMs,
      },
    };
  }

  if (rootHash.toLowerCase() !== expectedRoot.toLowerCase()) {
    return {
      status: "FAIL" as const,
      summary: `rootHash mismatch — expected ${expectedRoot}, got ${rootHash}`,
      data: {
        wallet: wallet.address,
        payloadBytes: payload.length,
        expectedRoot,
        rootHash,
        txHash,
        txSeq,
        uploadMs,
      },
    };
  }

  // Download with proof.
  const tmp = mkdtempSync(join(tmpdir(), "pact-g6-"));
  const downloadPath = join(tmp, "downloaded.bin");
  const downloadStart = Date.now();
  const dlErr = await indexer.download(rootHash, downloadPath, true);
  const downloadMs = Date.now() - downloadStart;
  if (dlErr) {
    return {
      status: "FAIL" as const,
      summary: `download failed: ${dlErr.message}`,
      data: {
        wallet: wallet.address,
        payloadBytes: payload.length,
        rootHash,
        txHash,
        txSeq,
        uploadMs,
        downloadMs,
        dlErr: dlErr.message,
      },
    };
  }
  if (!existsSync(downloadPath)) {
    return {
      status: "FAIL" as const,
      summary: "download claimed success but no file written",
      data: { downloadPath, rootHash, txHash, txSeq },
    };
  }

  const retrieved = readFileSync(downloadPath);
  const bytesMatch =
    retrieved.length === payload.length && retrieved.equals(payload);

  return {
    status: bytesMatch ? ("PASS" as const) : ("FAIL" as const),
    summary: bytesMatch
      ? `roundtrip OK rootHash=${rootHash} txSeq=${txSeq} (${payload.length}B up=${uploadMs}ms down=${downloadMs}ms)`
      : `bytes mismatch — uploaded ${payload.length}B, retrieved ${retrieved.length}B`,
    data: {
      wallet: wallet.address,
      balanceWei: balance.toString(),
      payloadBytes: payload.length,
      expectedRoot,
      rootHash,
      txHash,
      txSeq,
      timing: { uploadMs, downloadMs },
      bytesMatch,
    },
  };
});
