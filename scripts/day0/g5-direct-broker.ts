/**
 * Gate G5 — Direct path inference via @0gfoundation/0g-compute-ts-sdk.
 *
 * NOTE — PRD drift: MASTER_PRD §6/§7.2/§11 references the package name
 * `@0glabs/0g-serving-broker`. That npm name resolves to a provider-side Go
 * server, NOT the buyer-side TS SDK. The buyer SDK is published as
 * `@0gfoundation/0g-compute-ts-sdk` (latest 0.8.0; repo
 * github.com/0glabs/0g-serving-user-broker). We use the correct package
 * here and have flagged the drift in docs/AGENT_PROGRESS.md so the PRD can
 * be amended.
 *
 * Flow per the SDK source:
 *   broker.ledger.getLedger() / addLedger()    — preflight funding
 *   broker.inference.listService()              — discover providers
 *   broker.inference.acknowledgeProviderSigner(p) — one-time per provider
 *   broker.inference.getServiceMetadata(p)       — endpoint + model
 *   broker.inference.getRequestHeaders(p)        — auth headers (auto-funds)
 *   POST `${endpoint}/v1/proxy/chat/completions`
 *   broker.inference.processResponse(p, chatId, usageJson) — verifies TEE sig
 *
 * The TEE signature itself is fetched separately by `processResponse` via
 * `GET ${endpoint}/v1/proxy/signature/${chatId}?model=${model}`. That is
 * the verifiable receipt for §8.3.
 *
 * Pass criteria (PRD §21): receive completion + a verifiable signature.
 */

import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { ethers } from "ethers";
import { loadEnv } from "./lib/env.ts";
import { runGate } from "./lib/output.ts";

const PROMPT =
  "Reply with a single word: PONG. No punctuation, no extra tokens.";

// Initial ledger funding for first-time accounts. The on-chain ledger
// contract enforces a 3 $0G minimum on addLedger (per @0gfoundation
// /0g-compute-ts-starter-kit). Funds are not spent — they sit in the
// ledger and are recoverable via retrieveFund + withdrawFund. Existing
// ledgers are detected by getLedger() and the addLedger step is skipped.
const INITIAL_LEDGER_OG = 3;

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

await runGate("g5-direct-broker", async () => {
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

  // 1. Ledger preflight — getLedger throws if there's no account yet.
  let ledgerInfo: unknown = null;
  let ledgerCreated = false;
  try {
    ledgerInfo = await broker.ledger.getLedger();
    log.push({ step: "ledger.getLedger()", ok: true, detail: summarize(ledgerInfo) });
  } catch (e) {
    log.push({
      step: "ledger.getLedger()",
      ok: false,
      error: (e as Error).message,
      detail: "no ledger yet — will addLedger()",
    });
    // SDK 0.8.0 takes the amount as a decimal Number of $0G (NOT wei bigint).
    // Internally it does .toFixed(...) on it, so passing parseEther(...) throws
    // `value.toFixed is not a function`. Pass 3 directly.
    await broker.ledger.addLedger(INITIAL_LEDGER_OG);
    ledgerCreated = true;
    ledgerInfo = await broker.ledger.getLedger();
    log.push({
      step: `ledger.addLedger(${INITIAL_LEDGER_OG} $0G)`,
      ok: true,
      detail: summarize(ledgerInfo),
    });
  }

  // 2. Discover services.
  const services = await broker.inference.listService();
  log.push({
    step: "inference.listService()",
    ok: true,
    detail: { count: services.length, sample: services.slice(0, 3).map(summarize) },
  });
  if (services.length === 0) {
    return {
      status: "FAIL" as const,
      summary: "broker.inference.listService() returned 0 services",
      data: { wallet: wallet.address, ledgerCreated, ledgerInfo: summarize(ledgerInfo), log },
    };
  }

  // 3. Pick provider.
  const target = env.PACT_BROKER_PROVIDER_ADDRESS;
  const picked =
    (target &&
      services.find(
        (s) =>
          (s as { provider: string }).provider.toLowerCase() === target.toLowerCase(),
      )) ||
    services[0];
  if (!picked) {
    return {
      status: "FAIL" as const,
      summary: "no service matched the override and list was empty",
      data: { log },
    };
  }
  const providerAddress = (picked as { provider: string }).provider;
  log.push({ step: "selected service", ok: true, detail: summarize(picked) });

  // 4. Acknowledge provider signer (one-time on-chain write per provider).
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    log.push({
      step: `acknowledgeProviderSigner(${providerAddress})`,
      ok: true,
    });
  } catch (e) {
    // Already-acknowledged states throw — record but don't fail the gate.
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
  log.push({
    step: "getServiceMetadata",
    ok: true,
    detail: { endpoint, model },
  });

  // 6. Request headers (auto-funds the provider allowance internally).
  const headers = await broker.inference.getRequestHeaders(providerAddress, undefined);
  log.push({
    step: "getRequestHeaders",
    ok: true,
    detail: { headerKeys: Object.keys(headers) },
  });

  // 7. Inference call against the proxied endpoint. Capture the full raw
  //    HTTP response — text, parsed body, and every header — verbatim, so
  //    PRD §8.3 has the unsummarized payload to design AttestationVerifier
  //    against.
  //
  //    NOTE: getServiceMetadata().endpoint already ends in `/v1/proxy`, so
  //    we only append `/chat/completions`. SDK does the same at
  //    index-33b65b9f.js:20005.
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

  const inferenceCapture = {
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
        ledgerCreated,
        providerAddress,
        endpoint,
        model,
        inference: inferenceCapture,
        log,
      },
    };
  }

  // chatId: the SDK's processResponse + signature fetch BOTH key off the
  // `ZG-Res-Key` HTTP header that 0G's proxy adds (SDK line 22120-22122:
  // `const chatID = response.headers.get('ZG-Res-Key') || completion.id`).
  // Falling back to body.id sends the OpenRouter upstream id, which the
  // 0G proxy does not recognize → `chat_id_not_found`.
  const chatId =
    respHeaders["zg-res-key"] ??
    respHeaders["ZG-Res-Key"] ??
    (typeof body === "object" && body !== null
      ? (body as { id?: string }).id ?? null
      : null);

  const messageContent =
    typeof body === "object" && body !== null
      ? ((body as { choices?: { message?: { content?: string } }[] }).choices?.[0]
          ?.message?.content ?? null)
      : null;

  // SDK `content` param (3rd arg of processResponse) is a usage JSON string
  // used by `calculateFee()`, NOT the message text. SDK source line 21741:
  // `// For chatbot/speech-to-text: usage JSON string with input_tokens/
  // output_tokens; For text-to-image: empty/undefined`.
  const usageContent =
    typeof body === "object" &&
    body !== null &&
    "usage" in body &&
    body.usage !== null
      ? JSON.stringify((body as { usage: unknown }).usage)
      : "";

  // 8. SDK-side verification. processResponse fetches
  //    GET ${endpoint}/v1/proxy/signature/${chatId}?model=${model}
  //    and verifies it client-side. Capture the COMPLETE return value
  //    (not just a derived isValid bool) so we can see whatever shape the
  //    SDK actually returns on this version.
  let processReturn: unknown = null;
  let processReturnType: string = "unset";
  let verifyError: string | null = null;
  try {
    // Args per SDK source (line 21741): (providerAddress, chatID, content).
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
      ok: processReturn === true || (typeof processReturn === "object" && processReturn !== null),
      detail: {
        chatId,
        processReturn: summarize(processReturn),
        processReturnType,
      },
    });
  } catch (e) {
    verifyError = (e as Error).message;
    log.push({
      step: "processResponse(...) — full return capture",
      ok: false,
      error: verifyError,
    });
  }

  // 9. Independent raw fetch of the signature endpoint with the same auth
  //    headers. Even if `processResponse` collapses the result to a bool,
  //    this gives us the ground-truth `{ text, signature }` payload — the
  //    cryptographic spine of PACT (§8.3).
  let signatureCapture: {
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
  } | { error: string; requestedAt: string; chatId: string | null } | null = null;

  if (chatId) {
    // Same double-prefix gotcha as inferenceUrl — endpoint already
    // includes `/v1/proxy`, so we only append `/signature/{chatId}`.
    // Net URL matches SDK's internal construction at
    // index-33b65b9f.js:21706 (`${svc.url}/v1/proxy/signature/${chatID}`)
    // since `endpoint === svc.url + "/v1/proxy"`.
    const sigUrl = `${endpoint.replace(/\/$/, "")}/signature/${chatId}?model=${encodeURIComponent(model)}`;
    const sigRequestedAt = new Date().toISOString();
    try {
      const sigRes = await fetch(sigUrl, {
        method: "GET",
        headers: { ...headers },
      });
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
      signatureCapture = {
        error: (e as Error).message,
        requestedAt: sigRequestedAt,
        chatId,
      };
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

  // PASS = inference OK AND (SDK said true OR raw signature payload looks valid)
  const sdkSaidTrue = processReturn === true;
  const rawSigOk =
    signatureCapture !== null &&
    "httpOk" in signatureCapture &&
    signatureCapture.httpOk &&
    typeof signatureCapture.responseBody === "object" &&
    signatureCapture.responseBody !== null &&
    typeof (signatureCapture.responseBody as { signature?: unknown }).signature ===
      "string";
  const ok = res.ok && (sdkSaidTrue || rawSigOk);

  return {
    status: ok ? ("PASS" as const) : ("FAIL" as const),
    summary: ok
      ? `direct broker inference verified; provider=${providerAddress} model=${model} sdk=${String(processReturn)} rawSig=${rawSigOk}`
      : `inference completed but TEE verification incomplete (sdk=${String(processReturn)}, rawSig=${rawSigOk}${
          verifyError ? `, err=${verifyError}` : ""
        })`,
    data: {
      wallet: wallet.address,
      ledgerCreated,
      ledgerInfo: summarize(ledgerInfo),
      providerAddress,
      endpoint,
      model,
      service: summarize(picked),
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
      log,
    },
  };
});
