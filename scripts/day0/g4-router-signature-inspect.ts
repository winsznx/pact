/**
 * Gate G4 — inspect the Router response for a TEE signature/attestation field.
 *
 * MASTER_PRD §8.3 makes this the make-or-break primitive: if the Router
 * exposes a verifiable per-request signature we can recover on-chain, we go
 * with the Router path. Otherwise we fall back to Direct (G5).
 *
 * Librarian note: source review of @0gfoundation/0g-compute-ts-sdk indicates
 * the verifiable TEE signature lives on a SEPARATE provider endpoint
 * (`GET /v1/proxy/signature/{chatId}?model={model}`), not on the chat
 * completions response itself — neither in body nor headers. We expect
 * G4 to come back `signaturePresent: false` for the public Router and
 * confirm path B/C from PRD §8.3 (Direct path G5 is the route).
 *
 * This probe uses raw fetch (not the OpenAI SDK) so it captures HTTP headers
 * AND the full untyped body. It walks the response looking for plausible
 * signature/attestation fields and records every hit.
 *
 * Pass criteria (PRD §21): locate signature OR confirm absence — i.e. produce
 * a definitive answer, not a flaky one. We map that to PASS when our search
 * completes; the `signaturePresent` boolean in the JSON is the actionable bit.
 */

import { loadEnv } from "./lib/env.ts";
import { runGate } from "./lib/output.ts";

const PROMPT =
  "Reply with a single word: PONG. No punctuation, no extra tokens.";

const SIGNATURE_FIELD_HINTS = [
  "signature",
  "tee_signature",
  "teeSignature",
  "attestation",
  "attestation_report",
  "attestationReport",
  "proof",
  "tee",
  "enclave",
  "model_hash",
  "modelHash",
  "provider_id",
  "providerId",
  "provider_address",
  "providerAddress",
  "nonce",
  "quote",
  "ra_quote",
  "raQuote",
  "remote_attestation",
  "remoteAttestation",
];

const SIGNATURE_HEADER_HINTS = SIGNATURE_FIELD_HINTS.map((h) =>
  h.replace(/_/g, "-").toLowerCase(),
).concat([
  "x-tee-signature",
  "x-attestation",
  "x-attestation-signature",
  "x-provider-id",
  "x-provider-signature",
  "x-0g-attestation",
  "x-0g-signature",
  "x-model-hash",
  "x-nonce",
]);

interface FieldHit {
  path: string;
  hint: string;
  type: string;
  preview: string;
}

function previewValue(v: unknown): { type: string; preview: string } {
  if (v === null) return { type: "null", preview: "null" };
  if (typeof v === "string") {
    return {
      type: "string",
      preview: v.length > 200 ? `${v.slice(0, 200)}…(${v.length} chars)` : v,
    };
  }
  if (typeof v === "number" || typeof v === "boolean")
    return { type: typeof v, preview: String(v) };
  if (Array.isArray(v)) return { type: "array", preview: `len=${v.length}` };
  if (typeof v === "object")
    return { type: "object", preview: `keys=${Object.keys(v as object).join(",")}` };
  return { type: typeof v, preview: String(v) };
}

function walk(
  node: unknown,
  path: string,
  hits: FieldHit[],
  seen: WeakSet<object>,
): void {
  if (node === null || typeof node !== "object") return;
  if (seen.has(node as object)) return;
  seen.add(node as object);

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const childPath = path === "" ? key : `${path}.${key}`;
    const lower = key.toLowerCase();
    for (const hint of SIGNATURE_FIELD_HINTS) {
      if (lower === hint.toLowerCase() || lower.includes(hint.toLowerCase())) {
        const { type, preview } = previewValue(value);
        hits.push({ path: childPath, hint, type, preview });
        break;
      }
    }
    walk(value, childPath, hits, seen);
  }
}

await runGate("g4-router-signature-inspect", async () => {
  const env = loadEnv(["PACT_ROUTER_API_KEY"]);

  const url = `${env.PACT_ROUTER_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const requestedAt = new Date().toISOString();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.PACT_ROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.PACT_ROUTER_MODEL,
      messages: [{ role: "user", content: PROMPT }],
      temperature: 0,
      max_tokens: 512,
    }),
  });
  const respondedAt = new Date().toISOString();

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });

  const text = await res.text();
  let body: unknown;
  let bodyParseError: string | null = null;
  try {
    body = JSON.parse(text);
  } catch (e) {
    body = text;
    bodyParseError = (e as Error).message;
  }

  const headerHits: FieldHit[] = [];
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    for (const hint of SIGNATURE_HEADER_HINTS) {
      if (lower === hint || lower.includes(hint)) {
        headerHits.push({
          path: `headers.${name}`,
          hint,
          type: "string",
          preview:
            value.length > 200 ? `${value.slice(0, 200)}…(${value.length} chars)` : value,
        });
        break;
      }
    }
  }

  const bodyHits: FieldHit[] = [];
  if (typeof body === "object" && body !== null) {
    walk(body, "body", bodyHits, new WeakSet());
  }

  const hits = [...headerHits, ...bodyHits];
  const signaturePresent = hits.length > 0;
  const httpOk = res.ok;

  let status: "PASS" | "FAIL" | "INCONCLUSIVE";
  let summary: string;
  if (!httpOk) {
    status = "FAIL";
    summary = `HTTP ${res.status} — request failed; cannot inspect for signature`;
  } else if (signaturePresent) {
    status = "PASS";
    summary = `signature/attestation candidates FOUND: ${hits
      .map((h) => h.path)
      .slice(0, 6)
      .join(", ")}${hits.length > 6 ? ` +${hits.length - 6} more` : ""}`;
  } else {
    status = "PASS";
    summary =
      "no signature/attestation fields found in body or headers — Router path likely unviable, plan to use Direct (G5)";
  }

  return {
    status,
    summary,
    data: {
      request: {
        url,
        model: env.PACT_ROUTER_MODEL,
        prompt: PROMPT,
        requestedAt,
      },
      response: {
        respondedAt,
        httpStatus: res.status,
        httpOk,
        headers,
        bodyParseError,
        body,
      },
      analysis: {
        signaturePresent,
        hits,
        searchedHeaderHints: SIGNATURE_HEADER_HINTS,
        searchedBodyFieldHints: SIGNATURE_FIELD_HINTS,
      },
    },
  };
});
