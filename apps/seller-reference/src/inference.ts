// Inference + signature capture. Modeled on scripts/day0/g5-direct-broker.ts —
// the same SDK calls, the same chatId-from-header pattern, the same
// /signature/{chatId} fetch.
//
// v0.1: the prompt is hardcoded here. The buyer's actual prompt lives in
// their browser localStorage; we don't have a side-channel relay yet.
// v0.2 will pull the prompt from a Supabase queue (or from a message
// embedded in the JobCreated event payload, ECIES-decrypted with the
// seller's pubkey).

import type { ethers } from "ethers";
import { recoverMessageAddress, type Hex } from "viem";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";

import { log } from "./logger.ts";

const HARDCODED_PROMPT =
  "Audit this Solidity contract for reentrancy and overflow vulnerabilities, and explain the risks in 3-5 sentences:\n\n" +
  "function transfer(address to, uint256 amount) public {\n" +
  "    balances[msg.sender] -= amount;\n" +
  "    balances[to] += amount;\n" +
  "    emit Transfer(msg.sender, to, amount);\n" +
  "}";

export interface AttestationCapture {
  chatId: string;
  attestationText: string;
  signature: Hex;
  signingAddress: `0x${string}`;
  messageContent: string;
  usageContent: string;
}

/**
 * Run a single inference + signature capture against the configured
 * provider. Returns the canonical 5-field attestation text + signature
 * + recovered signing address. Throws on transport / SDK / verification
 * failure so the caller can decide whether to retry.
 *
 * `wallet` is an ethers.Wallet bound to the seller's private key — the
 * 0G Compute SDK uses it to sign provider auth headers and (on first
 * run) acknowledge the provider signer on chain.
 */
export async function runInferenceAndCaptureAttestation(
  wallet: ethers.Wallet,
  providerAddress: string,
): Promise<AttestationCapture> {
  const broker = await createZGComputeNetworkBroker(wallet);

  // Ledger preflight. addLedger throws if an account already exists, so
  // skip when getLedger returns successfully.
  try {
    await broker.ledger.getLedger();
    log.info("ledger.exists");
  } catch {
    log.info("ledger.creating", { initialOg: 3 });
    await broker.ledger.addLedger(3);
    log.info("ledger.created");
  }

  // Acknowledge the provider's TEE signer on chain — idempotent in
  // intent, but the SDK throws if it's already acknowledged. Swallow.
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    log.info("provider.acknowledged", { providerAddress });
  } catch (e) {
    log.info("provider.alreadyAcknowledged", {
      providerAddress,
      reason: (e as Error).message.slice(0, 100),
    });
  }

  const meta = (await broker.inference.getServiceMetadata(providerAddress)) as {
    endpoint: string;
    model: string;
  };
  const headers = (await broker.inference.getRequestHeaders(
    providerAddress,
    undefined,
  )) as Record<string, string>;

  const inferenceUrl = `${meta.endpoint.replace(/\/$/, "")}/chat/completions`;
  log.info("inference.request", {
    url: inferenceUrl,
    model: meta.model,
    promptBytes: HARDCODED_PROMPT.length,
  });

  const res = await fetch(inferenceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      model: meta.model,
      messages: [{ role: "user", content: HARDCODED_PROMPT }],
      stream: false,
    }),
  });

  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    respHeaders[k] = v;
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`inference HTTP ${res.status}: ${rawText.slice(0, 200)}`);
  }

  let body: { id?: string; choices?: { message?: { content?: string } }[]; usage?: unknown };
  try {
    body = JSON.parse(rawText);
  } catch (e) {
    throw new Error(`inference non-JSON body: ${(e as Error).message}`);
  }

  // chatId comes from ZG-Res-Key header — the body.id is the upstream
  // OpenRouter id which 0G's signature endpoint doesn't recognize
  // (chat_id_not_found). Phase 0 G5 captures pinned this gotcha.
  const chatId =
    respHeaders["zg-res-key"] ??
    respHeaders["ZG-Res-Key"] ??
    body.id ??
    null;
  if (!chatId) {
    throw new Error("no chatId in response (ZG-Res-Key header missing)");
  }
  const messageContent = body.choices?.[0]?.message?.content ?? "";
  const usageContent =
    body.usage !== null && body.usage !== undefined
      ? JSON.stringify(body.usage)
      : "";

  log.info("inference.response", {
    chatId,
    messageBytes: messageContent.length,
    usageContent,
  });

  // Run the SDK's processResponse — verifies the TEE signature client-side
  // and warms its internal cache. We capture but don't trust its return
  // alone; we also fetch the raw signature payload below.
  try {
    await broker.inference.processResponse(providerAddress, chatId, usageContent);
    log.info("sdk.processResponse.ok", { chatId });
  } catch (e) {
    log.warn("sdk.processResponse.failed", {
      chatId,
      reason: (e as Error).message.slice(0, 200),
    });
  }

  // Independent raw fetch of the signature endpoint — same auth headers,
  // same URL the SDK builds internally. Gives us the canonical
  // { text, signature, signing_address } payload that PactEscrow's
  // verifier will recompute on-chain.
  const sigUrl = `${meta.endpoint.replace(/\/$/, "")}/signature/${chatId}?model=${encodeURIComponent(meta.model)}`;
  const sigRes = await fetch(sigUrl, { method: "GET", headers: { ...headers } });
  const sigRaw = await sigRes.text();
  if (!sigRes.ok) {
    throw new Error(`signature fetch HTTP ${sigRes.status}: ${sigRaw.slice(0, 200)}`);
  }
  const sigBody = JSON.parse(sigRaw) as {
    text: string;
    signature: string;
    signing_address: string;
  };

  if (
    typeof sigBody.text !== "string" ||
    typeof sigBody.signature !== "string" ||
    typeof sigBody.signing_address !== "string"
  ) {
    throw new Error(
      `signature payload missing fields (got keys: ${Object.keys(sigBody).join(",")})`,
    );
  }

  const signature = (sigBody.signature.startsWith("0x")
    ? sigBody.signature
    : `0x${sigBody.signature}`) as Hex;

  // Sanity: client-side recover via viem. Same primitive as
  // AttestationVerifier.sol (EIP-191 prefix + ECDSA secp256k1 recover).
  const textBytes = new TextEncoder().encode(sigBody.text);
  const textHex = ("0x" +
    Array.from(textBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as Hex;
  const recovered = await recoverMessageAddress({
    message: { raw: textHex },
    signature,
  });
  if (recovered.toLowerCase() !== sigBody.signing_address.toLowerCase()) {
    throw new Error(
      `local recovery mismatch: recovered=${recovered} declared=${sigBody.signing_address}`,
    );
  }
  log.info("attestation.localVerifyOk", {
    chatId,
    recovered,
    declared: sigBody.signing_address,
  });

  return {
    chatId,
    attestationText: sigBody.text,
    signature,
    signingAddress: recovered as `0x${string}`,
    messageContent,
    usageContent,
  };
}

export { HARDCODED_PROMPT };
