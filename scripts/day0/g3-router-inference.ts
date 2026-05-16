/**
 * Gate G3 — Router inference end-to-end.
 *
 * Goal: prove the 0G Compute Router accepts our API key and returns a valid
 * OpenAI-compatible chat completion, per MASTER_PRD §6 (0G Compute primitive).
 *
 * Pass criteria (PRD §21): receive a valid completion response.
 *
 * NOTE — librarian flagged that the public Router endpoint
 * (`router-api.0g.ai/v1`) and the model identifier `glm-5-fp8` referenced
 * in the PRD are NOT verifiable from the SDK source. We do a preflight
 * `GET /models` so a misconfigured base URL fails fast with a clear message
 * before we burn an inference call.
 */

import OpenAI from "openai";
import { loadEnv } from "./lib/env.ts";
import { runGate } from "./lib/output.ts";

const PROMPT =
  "Reply with a single word: PONG. No punctuation, no extra tokens.";

await runGate("g3-router-inference", async () => {
  const env = loadEnv(["PACT_ROUTER_API_KEY"]);

  // Preflight: list models. If this 404s/401s, the base URL or key are
  // wrong and there is no point making a chat call.
  const modelsUrl = `${env.PACT_ROUTER_BASE_URL.replace(/\/$/, "")}/models`;
  const preflightRes = await fetch(modelsUrl, {
    headers: { authorization: `Bearer ${env.PACT_ROUTER_API_KEY}` },
  });
  const preflightText = await preflightRes.text();
  let preflightBody: unknown;
  try {
    preflightBody = JSON.parse(preflightText);
  } catch {
    preflightBody = preflightText.slice(0, 500);
  }
  if (!preflightRes.ok) {
    return {
      status: "FAIL" as const,
      summary: `preflight GET /models returned HTTP ${preflightRes.status} — Router base URL or API key is wrong, or endpoint is offline`,
      data: {
        preflight: {
          url: modelsUrl,
          status: preflightRes.status,
          body: preflightBody,
        },
        configuredBaseUrl: env.PACT_ROUTER_BASE_URL,
      },
    };
  }

  const client = new OpenAI({
    baseURL: env.PACT_ROUTER_BASE_URL,
    apiKey: env.PACT_ROUTER_API_KEY!,
  });

  const requestedAt = new Date().toISOString();
  const completion = await client.chat.completions.create({
    model: env.PACT_ROUTER_MODEL,
    messages: [{ role: "user", content: PROMPT }],
    temperature: 0,
    // Reasoning models on the Router (e.g. GLM-5, DeepSeek-V3.2) burn
    // tens of tokens on internal reasoning before emitting the answer.
    // 16 is too low and produces finish=length with empty content.
    max_tokens: 512,
  });
  const respondedAt = new Date().toISOString();

  const choice = completion.choices?.[0];
  const content = choice?.message?.content ?? null;
  const finishReason = choice?.finish_reason ?? null;

  const ok =
    typeof content === "string" &&
    content.length > 0 &&
    finishReason !== null &&
    finishReason !== "content_filter";

  return {
    status: ok ? ("PASS" as const) : ("FAIL" as const),
    summary: ok
      ? `model=${completion.model} content=${JSON.stringify(content)} finish=${finishReason}`
      : `no usable completion content (finish=${finishReason})`,
    data: {
      preflight: { url: modelsUrl, status: preflightRes.status, body: preflightBody },
      request: {
        baseURL: env.PACT_ROUTER_BASE_URL,
        model: env.PACT_ROUTER_MODEL,
        prompt: PROMPT,
        requestedAt,
      },
      response: {
        respondedAt,
        id: completion.id,
        model: completion.model,
        created: completion.created,
        usage: completion.usage,
        finishReason,
        content,
        rawCompletion: completion,
      },
    },
  };
});
