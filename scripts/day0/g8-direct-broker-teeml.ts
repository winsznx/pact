/**
 * Gate G8 — Phase 1.5 — Direct broker against a TeeML provider.
 *
 * Purpose: G5 verified the attestation payload shape for a TeeTLS provider
 * (model running on a centralized upstream, the 0G TEE proxy signs over
 * the I/O hashes + TLS cert fingerprint). The PRD §5.3 / §15.1 / on-chain
 * AttestationVerifier all key off that shape. This probe asks: do TeeML
 * providers (model running INSIDE the TDX enclave) emit the same wire
 * shape, a compatible variant, or a different scheme entirely?
 *
 * Target: zai-org/GLM-5.1-FP8 — chatbot + verifiability=TeeML per the G3
 * catalog. provider_count=1 so there is exactly one provider serving it.
 *
 * Reuses the ledger funded during G5. Does NOT call addLedger.
 *
 * Verdict (logged to stdout + JSON):
 *   SAME_SHAPE          — 5 colon-separated fields, ECDSA recovery via
 *                         EIP-191 personal_sign, every field matches the
 *                         G5 schema (64-hex hashes, ASCII labels). The
 *                         existing AttestationVerifier works unchanged
 *                         and parseAttestationText also works unchanged.
 *   COMPATIBLE_VARIANT  — recovery still works (so recover/verify work
 *                         unchanged), but the 5-field schema differs
 *                         enough that parseAttestationText would revert
 *                         or produce semantically wrong components. e.g.
 *                         tls_cert_fingerprint is empty or non-hex, or a
 *                         colon-field count differs. Verifier needs no
 *                         crypto change; off-chain parsers do.
 *   DIFFERENT_SCHEME    — recovery fails under both EIP-191 and raw
 *                         keccak256 prefixes. Either signing_algo is not
 *                         ECDSA, the signature length differs, or the
 *                         canonical message bytes are encoded differently.
 *                         Verifier needs a v2 path.
 */

import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { ethers } from "ethers";
import { loadEnv } from "./lib/env.ts";
import { runGate } from "./lib/output.ts";

const PROMPT =
  "Reply with a single word: PONG. No punctuation, no extra tokens.";

const TARGET_MODEL = "zai-org/GLM-5.1-FP8";
const TARGET_MODEL_NEEDLE = "GLM-5.1"; // robust substring used to filter listService
const G5_REFERENCE = {
  fieldCount: 5,
  signingAlgo: "ecdsa",
  signatureBytes: 65, // r || s || v
  hashAHexLen: 64,
  hashBHexLen: 64,
  tlsFpHexLen: 64,
  providerType: "centralized",
  providerIdentity: "openrouter",
} as const;

interface AttemptLog {
  step: string;
  ok: boolean;
  detail?: unknown;
  error?: string;
}

function summarize(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v))
    return { array: true, length: v.length, sample: v.slice(0, 3).map(summarize) };
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "function") out[k] = "[function]";
      else if (typeof val === "bigint") out[k] = val.toString();
      else if (typeof val === "object" && val !== null) out[k] = summarize(val);
      else out[k] = val;
    }
    return out;
  }
  return v;
}

/**
 * SDK list entries surface as array-like proxies that ALSO carry named
 * properties. summarize() truncates the array form to 3 elements (great for
 * G5's narrow capture, useless when we need to scan every field for the
 * target model id). dumpService walks every enumerable own key — covers
 * both numeric indices and the named accessors — and stringifies bigints.
 */
function dumpService(s: unknown): Record<string, unknown> {
  if (s === null || typeof s !== "object") return { value: String(s) };
  const out: Record<string, unknown> = {};
  for (const key in s as object) {
    const val = (s as Record<string, unknown>)[key];
    if (typeof val === "bigint") out[key] = val.toString();
    else if (val && typeof val === "object") out[key] = summarize(val);
    else out[key] = val;
  }
  return out;
}

function findTargetService(services: unknown[]): { picked: unknown; index: number } | null {
  // 1) env override pin
  const override = process.env.PACT_TEEML_PROVIDER_ADDRESS;
  if (override) {
    const i = services.findIndex(
      (s) =>
        (s as { provider?: string }).provider?.toLowerCase() ===
        override.toLowerCase(),
    );
    if (i !== -1) return { picked: services[i], index: i };
  }
  // 2) fuzzy match on the model name across every dumped field
  for (let i = 0; i < services.length; i++) {
    const dump = dumpService(services[i]);
    const haystack = JSON.stringify(dump).toLowerCase();
    if (haystack.includes(TARGET_MODEL_NEEDLE.toLowerCase())) {
      return { picked: services[i], index: i };
    }
  }
  return null;
}

interface SignaturePayload {
  text?: string;
  signature?: string;
  signing_address?: string;
  signing_algo?: string;
  provider_type?: string;
  provider_identity?: string;
  tls_cert_fingerprint?: string;
}

type Verdict = "SAME_SHAPE" | "COMPATIBLE_VARIANT" | "DIFFERENT_SCHEME";

interface VerdictReport {
  verdict: Verdict;
  reasons: string[];
  comparedAgainst: typeof G5_REFERENCE;
  observed: {
    fieldCount: number | null;
    signingAlgo: string | null;
    signatureLength: number | null;
    signatureByteLen: number | null;
    hashALen: number | null;
    hashBLen: number | null;
    providerType: string | null;
    providerIdentity: string | null;
    tlsFpLen: number | null;
    eip191Recovery: { recovered: string | null; matches: boolean } | null;
    rawKeccakRecovery: { recovered: string | null; matches: boolean } | null;
  };
}

function isHex(s: string, expectedLen: number): boolean {
  return new RegExp(`^[0-9a-fA-F]{${expectedLen}}$`).test(s);
}

function buildVerdict(payload: SignaturePayload): VerdictReport {
  const reasons: string[] = [];
  const observed: VerdictReport["observed"] = {
    fieldCount: null,
    signingAlgo: payload.signing_algo ?? null,
    signatureLength: payload.signature?.length ?? null,
    signatureByteLen: null,
    hashALen: null,
    hashBLen: null,
    providerType: null,
    providerIdentity: null,
    tlsFpLen: null,
    eip191Recovery: null,
    rawKeccakRecovery: null,
  };

  if (!payload.text || typeof payload.text !== "string") {
    reasons.push("payload.text missing or non-string");
    return { verdict: "DIFFERENT_SCHEME", reasons, comparedAgainst: G5_REFERENCE, observed };
  }
  if (!payload.signature || typeof payload.signature !== "string") {
    reasons.push("payload.signature missing or non-string");
    return { verdict: "DIFFERENT_SCHEME", reasons, comparedAgainst: G5_REFERENCE, observed };
  }

  const parts = payload.text.split(":");
  observed.fieldCount = parts.length;

  // Signature byte length (strip 0x).
  const sigHex = payload.signature.startsWith("0x")
    ? payload.signature.slice(2)
    : payload.signature;
  observed.signatureByteLen = sigHex.length / 2;

  // Try EIP-191 personal_sign recovery first (matches the on-chain
  // MessageHashUtils.toEthSignedMessageHash path).
  const expectedSigner = payload.signing_address ?? "";
  let eip191Recovered: string | null = null;
  let eip191Matches = false;
  try {
    eip191Recovered = ethers.verifyMessage(payload.text, payload.signature);
    eip191Matches =
      !!expectedSigner &&
      eip191Recovered.toLowerCase() === expectedSigner.toLowerCase();
  } catch (e) {
    reasons.push(`ethers.verifyMessage threw: ${(e as Error).message}`);
  }
  observed.eip191Recovery = { recovered: eip191Recovered, matches: eip191Matches };

  // Try raw keccak256 (no EIP-191 prefix) recovery as a secondary path.
  let rawRecovered: string | null = null;
  let rawMatches = false;
  try {
    const rawHash = ethers.keccak256(ethers.toUtf8Bytes(payload.text));
    rawRecovered = ethers.recoverAddress(rawHash, payload.signature);
    rawMatches =
      !!expectedSigner &&
      rawRecovered.toLowerCase() === expectedSigner.toLowerCase();
  } catch (e) {
    reasons.push(`raw keccak recover threw: ${(e as Error).message}`);
  }
  observed.rawKeccakRecovery = { recovered: rawRecovered, matches: rawMatches };

  // Field-shape inspection (if 5 fields).
  if (parts.length === 5) {
    const [hashA, hashB, ptype, pidentity, tlsfp] = parts as [
      string,
      string,
      string,
      string,
      string,
    ];
    observed.hashALen = hashA.length;
    observed.hashBLen = hashB.length;
    observed.providerType = ptype;
    observed.providerIdentity = pidentity;
    observed.tlsFpLen = tlsfp.length;

    if (!isHex(hashA, 64)) reasons.push(`field0 (hashA) not 64-hex (len=${hashA.length})`);
    if (!isHex(hashB, 64)) reasons.push(`field1 (hashB) not 64-hex (len=${hashB.length})`);
    if (!isHex(tlsfp, 64)) reasons.push(`field4 (tlsCertFingerprint) not 64-hex (len=${tlsfp.length})`);
    if (ptype !== G5_REFERENCE.providerType)
      reasons.push(`provider_type "${ptype}" differs from G5 "${G5_REFERENCE.providerType}"`);
    if (pidentity !== G5_REFERENCE.providerIdentity)
      reasons.push(
        `provider_identity "${pidentity}" differs from G5 "${G5_REFERENCE.providerIdentity}"`,
      );
  } else {
    reasons.push(`field count ${parts.length} differs from G5 schema (5)`);
  }

  if (
    payload.signing_algo &&
    payload.signing_algo.toLowerCase() !== G5_REFERENCE.signingAlgo
  ) {
    reasons.push(
      `signing_algo "${payload.signing_algo}" differs from G5 "${G5_REFERENCE.signingAlgo}"`,
    );
  }
  if (observed.signatureByteLen !== G5_REFERENCE.signatureBytes) {
    reasons.push(
      `signature byte length ${observed.signatureByteLen} differs from G5 ${G5_REFERENCE.signatureBytes}`,
    );
  }

  // Verdict decision tree.
  // 1) recovery fails under both prefixes -> DIFFERENT_SCHEME.
  if (!eip191Matches && !rawMatches) {
    return { verdict: "DIFFERENT_SCHEME", reasons, comparedAgainst: G5_REFERENCE, observed };
  }

  // 2) only raw recovery works -> verifier needs a different prefix path.
  //    Treat as DIFFERENT_SCHEME because the on-chain verifier specifically
  //    uses MessageHashUtils.toEthSignedMessageHash; swapping that out is a
  //    crypto-path change.
  if (!eip191Matches && rawMatches) {
    reasons.push("EIP-191 recovery FAILED but raw keccak recovery worked — verifier prefix path mismatch");
    return { verdict: "DIFFERENT_SCHEME", reasons, comparedAgainst: G5_REFERENCE, observed };
  }

  // 3) EIP-191 works. Now decide SAME_SHAPE vs COMPATIBLE_VARIANT.
  //    SAME_SHAPE = parseAttestationText would succeed (5 fields, hashA+B+tlsfp
  //    all 64-hex). Field VALUES differing (e.g. provider_type="tee") still
  //    qualify as SAME_SHAPE since the on-chain parser is type-only, not
  //    value-validating.
  const wireSchemaIntact =
    parts.length === 5 &&
    isHex(parts[0]!, 64) &&
    isHex(parts[1]!, 64) &&
    isHex(parts[4]!, 64);

  if (wireSchemaIntact) {
    return { verdict: "SAME_SHAPE", reasons, comparedAgainst: G5_REFERENCE, observed };
  }
  return { verdict: "COMPATIBLE_VARIANT", reasons, comparedAgainst: G5_REFERENCE, observed };
}

interface InferenceCapture {
  requestedAt: string;
  respondedAt: string;
  httpStatus: number;
  httpStatusText: string;
  httpOk: boolean;
  requestUrl: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  responseRawText: string;
  responseBody: unknown;
  responseBodyParseError: string | null;
}

interface SignatureCaptureSuccess {
  requestedAt: string;
  respondedAt: string;
  requestUrl: string;
  requestHeaders: Record<string, string>;
  httpStatus: number;
  httpStatusText: string;
  httpOk: boolean;
  responseHeaders: Record<string, string>;
  responseRawText: string;
  responseBody: unknown;
  responseBodyParseError: string | null;
}

type SignatureCapture =
  | SignatureCaptureSuccess
  | { error: string; requestedAt: string; chatId: string | null }
  | null;

await runGate("g8-direct-broker-teeml", async () => {
  const env = loadEnv(["PACT_PRIVATE_KEY"]);
  const log: AttemptLog[] = [];

  const provider = new ethers.JsonRpcProvider(env.PACT_RPC_URL);
  const wallet = new ethers.Wallet(env.PACT_PRIVATE_KEY!, provider);
  const balance = await provider.getBalance(wallet.address);
  log.push({
    step: "wallet ready",
    ok: true,
    detail: {
      address: wallet.address,
      balanceWei: balance.toString(),
      balanceOg: ethers.formatEther(balance),
    },
  });

  const broker = await createZGComputeNetworkBroker(wallet);
  log.push({ step: "createZGComputeNetworkBroker(wallet)", ok: true });

  // 1. Reuse the ledger funded by G5. Bail loudly if it's gone — never
  //    silently re-create.
  let ledgerInfo: unknown = null;
  try {
    ledgerInfo = await broker.ledger.getLedger();
    log.push({ step: "ledger.getLedger()", ok: true, detail: summarize(ledgerInfo) });
  } catch (e) {
    return {
      status: "FAIL" as const,
      summary: `ledger missing — G5 prerequisite not satisfied (${(e as Error).message})`,
      data: { wallet: wallet.address, log },
    };
  }

  // 2. Discover services. Capture EVERY field of every service (no
  //    summarize() truncation) so we can audit the wire shape post-hoc and
  //    so the model match below has all candidate fields to scan.
  const services = await broker.inference.listService();
  const allServiceDumps = services.map(dumpService);
  log.push({
    step: "inference.listService() — full shape dump",
    ok: true,
    detail: {
      count: services.length,
      services: allServiceDumps,
    },
  });
  if (services.length === 0) {
    return {
      status: "FAIL" as const,
      summary: "broker.inference.listService() returned 0 services",
      data: { wallet: wallet.address, ledgerInfo: summarize(ledgerInfo), log },
    };
  }

  // 3. Pick the GLM-5.1-FP8 (TeeML) provider.
  const found = findTargetService(services);
  if (!found) {
    return {
      status: "FAIL" as const,
      summary: `no service in listService() advertises ${TARGET_MODEL} (or substring "${TARGET_MODEL_NEEDLE}")`,
      data: {
        wallet: wallet.address,
        ledgerInfo: summarize(ledgerInfo),
        services: allServiceDumps,
        log,
      },
    };
  }
  const providerAddress = (found.picked as { provider: string }).provider;
  log.push({
    step: "selected TeeML provider",
    ok: true,
    detail: {
      index: found.index,
      providerAddress,
      fullDump: dumpService(found.picked),
    },
  });

  // 4. Acknowledge provider signer.
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    log.push({ step: `acknowledgeProviderSigner(${providerAddress})`, ok: true });
  } catch (e) {
    log.push({
      step: `acknowledgeProviderSigner(${providerAddress})`,
      ok: false,
      error: (e as Error).message,
      detail: "may be benign if already acknowledged",
    });
  }

  // 5. Service metadata (endpoint + model).
  const meta = await broker.inference.getServiceMetadata(providerAddress);
  const endpoint = (meta as { endpoint: string }).endpoint;
  const model = (meta as { model: string }).model;
  log.push({ step: "getServiceMetadata", ok: true, detail: { endpoint, model } });

  // 6. Auth headers. SDK auto-funds a per-provider sub-account out of the
  //    ledger here. If the ledger's *available* balance can't cover the
  //    transfer, the call throws — caught here so we still write the
  //    discovery data we already have. User must run
  //    `broker.ledger.depositFund(2)` (or `0g-compute-cli deposit
  //    --amount 2`) to top up; we will not silently spend $0G.
  let headers: Record<string, string>;
  try {
    headers = await broker.inference.getRequestHeaders(providerAddress, undefined);
    log.push({
      step: "getRequestHeaders",
      ok: true,
      detail: { headerKeys: Object.keys(headers) },
    });
  } catch (e) {
    const msg = (e as Error).message;
    log.push({ step: "getRequestHeaders", ok: false, error: msg });
    return {
      status: "FAIL" as const,
      summary: `getRequestHeaders failed (likely sub-account funding) — provider=${providerAddress} model=${model}: ${msg}`,
      data: {
        target: { model: TARGET_MODEL, needle: TARGET_MODEL_NEEDLE },
        wallet: wallet.address,
        ledgerInfo: summarize(ledgerInfo),
        servicesCount: services.length,
        servicesAll: allServiceDumps,
        pickedService: dumpService(found.picked),
        providerAddress,
        endpoint,
        model,
        unblock: {
          reason: "Phase 1.5 needs a fresh per-provider sub-account; ledger short on available balance.",
          actions: [
            "broker.ledger.depositFund(2)  // adds 2 $0G to ledger available balance",
            "0g-compute-cli deposit --amount 2",
          ],
        },
        log,
      },
    };
  }

  // 7. Inference call.
  const inferenceUrl = `${endpoint.replace(/\/$/, "")}/chat/completions`;
  const requestedAt = new Date().toISOString();
  const res = await fetch(inferenceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: PROMPT }],
      stream: false,
    }),
  });
  const respondedAt = new Date().toISOString();
  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    respHeaders[k] = v;
  });
  const rawText = await res.text();
  let body: unknown;
  let bodyParseError: string | null = null;
  try {
    body = JSON.parse(rawText);
  } catch (e) {
    body = rawText;
    bodyParseError = (e as Error).message;
  }
  const inferenceCapture: InferenceCapture = {
    requestedAt,
    respondedAt,
    httpStatus: res.status,
    httpStatusText: res.statusText,
    httpOk: res.ok,
    requestUrl: inferenceUrl,
    requestHeaders: { "Content-Type": "application/json", ...headers },
    responseHeaders: respHeaders,
    responseRawText: rawText,
    responseBody: body,
    responseBodyParseError: bodyParseError,
  };
  log.push({
    step: "POST /v1/proxy/chat/completions (raw capture)",
    ok: res.ok,
    detail: {
      httpStatus: res.status,
      headerKeys: Object.keys(respHeaders),
      rawTextBytes: rawText.length,
    },
  });

  if (!res.ok) {
    return {
      status: "FAIL" as const,
      summary: `inference HTTP ${res.status}`,
      data: {
        wallet: wallet.address,
        providerAddress,
        endpoint,
        model,
        inference: inferenceCapture,
        log,
      },
    };
  }

  // 8. chatId via ZG-Res-Key header (per G5 lessons).
  const chatId =
    respHeaders["zg-res-key"] ??
    respHeaders["ZG-Res-Key"] ??
    (typeof body === "object" && body !== null
      ? ((body as { id?: string }).id ?? null)
      : null);

  const messageContent =
    typeof body === "object" && body !== null
      ? ((body as { choices?: { message?: { content?: string } }[] }).choices?.[0]
          ?.message?.content ?? null)
      : null;

  const usageContent =
    typeof body === "object" && body !== null && "usage" in body && body.usage !== null
      ? JSON.stringify((body as { usage: unknown }).usage)
      : "";

  // 9. Capture processResponse return value alongside the raw signature
  //    fetch (mirrors G5).
  let processReturn: unknown = null;
  let processReturnType = "unset";
  let verifyError: string | null = null;
  try {
    processReturn = await broker.inference.processResponse(
      providerAddress,
      chatId ?? "",
      usageContent,
    );
    processReturnType =
      processReturn === null
        ? "null"
        : Array.isArray(processReturn)
          ? "array"
          : typeof processReturn;
    log.push({
      step: "processResponse(...) — full return capture",
      ok:
        processReturn === true ||
        (typeof processReturn === "object" && processReturn !== null),
      detail: { chatId, processReturn: summarize(processReturn), processReturnType },
    });
  } catch (e) {
    verifyError = (e as Error).message;
    log.push({
      step: "processResponse(...) — full return capture",
      ok: false,
      error: verifyError,
    });
  }

  // 10. Independent raw fetch of the signature endpoint — the ground-truth
  //     cryptographic payload we verdict against.
  let signatureCapture: SignatureCapture = null;
  if (chatId) {
    const sigUrl = `${endpoint.replace(/\/$/, "")}/signature/${chatId}?model=${encodeURIComponent(model)}`;
    const sigRequestedAt = new Date().toISOString();
    try {
      const sigRes = await fetch(sigUrl, { method: "GET", headers: { ...headers } });
      const sigRespondedAt = new Date().toISOString();
      const sigHeaders: Record<string, string> = {};
      sigRes.headers.forEach((v, k) => {
        sigHeaders[k] = v;
      });
      const sigRawText = await sigRes.text();
      let sigBody: unknown;
      let sigBodyParseError: string | null = null;
      try {
        sigBody = JSON.parse(sigRawText);
      } catch (e) {
        sigBody = sigRawText;
        sigBodyParseError = (e as Error).message;
      }
      signatureCapture = {
        requestedAt: sigRequestedAt,
        respondedAt: sigRespondedAt,
        requestUrl: sigUrl,
        requestHeaders: { ...headers },
        httpStatus: sigRes.status,
        httpStatusText: sigRes.statusText,
        httpOk: sigRes.ok,
        responseHeaders: sigHeaders,
        responseRawText: sigRawText,
        responseBody: sigBody,
        responseBodyParseError: sigBodyParseError,
      };
      log.push({
        step: "GET /v1/proxy/signature/{chatId} (raw capture)",
        ok: sigRes.ok,
        detail: {
          httpStatus: sigRes.status,
          headerKeys: Object.keys(sigHeaders),
          rawTextBytes: sigRawText.length,
        },
      });
    } catch (e) {
      signatureCapture = { error: (e as Error).message, requestedAt: sigRequestedAt, chatId };
      log.push({
        step: "GET /v1/proxy/signature/{chatId} (raw capture)",
        ok: false,
        error: (e as Error).message,
      });
    }
  } else {
    log.push({
      step: "GET /v1/proxy/signature/{chatId} (raw capture)",
      ok: false,
      error: "no chatId in inference response — cannot fetch signature",
    });
  }

  // 11. Verdict.
  let verdictReport: VerdictReport | null = null;
  if (
    signatureCapture !== null &&
    "httpOk" in signatureCapture &&
    signatureCapture.httpOk &&
    typeof signatureCapture.responseBody === "object" &&
    signatureCapture.responseBody !== null
  ) {
    verdictReport = buildVerdict(signatureCapture.responseBody as SignaturePayload);
    log.push({
      step: "verdict computed",
      ok: true,
      detail: {
        verdict: verdictReport.verdict,
        reasons: verdictReport.reasons,
        eip191Recovery: verdictReport.observed.eip191Recovery,
        rawKeccakRecovery: verdictReport.observed.rawKeccakRecovery,
      },
    });
  }

  const sigOk =
    signatureCapture !== null &&
    "httpOk" in signatureCapture &&
    signatureCapture.httpOk;
  const ok = res.ok && sigOk && verdictReport !== null;

  const summary = ok
    ? `verdict=${verdictReport!.verdict} provider=${providerAddress} model=${model} eip191=${verdictReport!.observed.eip191Recovery?.matches ?? false} raw=${verdictReport!.observed.rawKeccakRecovery?.matches ?? false}`
    : `probe incomplete — sigOk=${sigOk}, verdict=${verdictReport?.verdict ?? "unset"}${verifyError ? `, err=${verifyError}` : ""}`;

  return {
    status: ok ? ("PASS" as const) : ("FAIL" as const),
    summary,
    data: {
      target: { model: TARGET_MODEL, needle: TARGET_MODEL_NEEDLE },
      wallet: wallet.address,
      ledgerInfo: summarize(ledgerInfo),
      servicesCount: services.length,
      pickedService: dumpService(found.picked),
      providerAddress,
      endpoint,
      model,
      authHeaders: headers,
      inference: inferenceCapture,
      verification: {
        chatId,
        chatIdSource: respHeaders["zg-res-key"]
          ? "header:zg-res-key"
          : respHeaders["ZG-Res-Key"]
            ? "header:ZG-Res-Key"
            : "body.id",
        messageContent,
        usageContent,
        processReturn,
        processReturnType,
        verifyError,
      },
      signatureFetch: signatureCapture,
      verdict: verdictReport,
      log,
    },
  };
});
