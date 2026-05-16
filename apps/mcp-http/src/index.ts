/**
 * @pact/mcp-http — PACT MCP server over Streamable HTTP transport.
 *
 * Hosted at https://mcp.trypact.xyz so any MCP-compatible client can attach
 * by URL — no npm install, no local process. Drop this into a Claude /
 * Cursor / Cline / Windsurf config:
 *
 *   { "mcpServers": { "trypact": { "url": "https://mcp.trypact.xyz/mcp" } } }
 *
 * Exposes the 4 READ-ONLY tools from @trypact/mcp-server:
 *   - list_services
 *   - get_service
 *   - get_job
 *   - verify_attestation
 *
 * The write tool `run` (which escrows real $0G) is INTENTIONALLY OMITTED.
 * Hosting a buyer private key on a shared multi-tenant remote server is a
 * security non-starter — users who want to pay should install
 * `@trypact/mcp-server` locally where their key never leaves the machine.
 *
 * Mode: stateless. Each POST /mcp builds a fresh McpServer + transport
 * with `sessionIdGenerator: undefined`. No session map, no in-memory user
 * state. Concurrency-safe by construction.
 */

import express from "express";
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  createPublicClient,
  defineChain,
  http,
  type PublicClient,
} from "viem";
import { PactClient, JobState, JOB_STATE_LABEL } from "@trypact/sdk";

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const startedAt = Date.now();

const ogMainnet = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.PACT_RPC_URL ?? "https://evmrpc.0g.ai"],
    },
  },
  blockExplorers: {
    default: { name: "0G ChainScan", url: "https://chainscan.0g.ai" },
  },
});

const publicClient: PublicClient = createPublicClient({
  chain: ogMainnet,
  transport: http(undefined, { batch: true, retryCount: 2 }),
});

const pact = new PactClient({ publicClient });

function jsonify(value: unknown): string {
  return JSON.stringify(
    value,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}

/**
 * Build a fresh McpServer instance with the 4 read-only tools registered.
 * Called once per HTTP request — stateless mode means no cross-request state.
 */
function buildServer(): McpServer {
  const server = new McpServer({
    name: "trypact",
    version: "0.1.0",
  });

  server.tool(
    "list_services",
    "List every AI service registered on PACT (0G mainnet, chainId 16661). Returns service id, seller, model, signing address, price per call, registration timestamp. Use this to browse the marketplace.",
    {},
    async () => {
      const services = await pact.services.list();
      return {
        content: [
          {
            type: "text",
            text: jsonify({
              network: "0g-mainnet",
              chainId: 16661,
              count: services.length,
              services,
            }),
          },
        ],
      };
    },
  );

  server.tool(
    "get_service",
    "Fetch a single PACT service by id. Returns the same Service struct as list_services but for one record. Use this to confirm pricing + signing address.",
    {
      serviceId: z
        .string()
        .regex(/^\d+$/)
        .describe("Service id, stringified positive integer (e.g. '1')."),
    },
    async ({ serviceId }) => {
      const svc = await pact.services.get(BigInt(serviceId));
      return {
        content: [{ type: "text", text: jsonify(svc) }],
      };
    },
  );

  server.tool(
    "get_job",
    "Fetch a single PACT job by id. Returns the job's full state: serviceId, buyer, seller, escrow amount, state (Pending/Settled/Expired/etc.), attestation bytes if present. Use this to inspect any historical job on-chain.",
    {
      jobId: z
        .string()
        .regex(/^\d+$/)
        .describe("Job id, stringified positive integer (e.g. '2')."),
    },
    async ({ jobId }) => {
      const job = await pact.jobs.get(BigInt(jobId));
      return {
        content: [
          {
            type: "text",
            text: jsonify({
              ...job,
              stateLabel: JOB_STATE_LABEL[job.state],
            }),
          },
        ],
      };
    },
  );

  server.tool(
    "verify_attestation",
    "Locally verify a settled PACT job's TEE attestation. Pure cryptography, no chain RPC needed for the recovery itself. Runs EIP-191 + ECDSA secp256k1 recovery against the job's attestation bytes, compares the recovered signer to the service's registered signing address. Returns ok=true on match.",
    {
      jobId: z
        .string()
        .regex(/^\d+$/)
        .describe("Job id of a settled job (state == 3)."),
    },
    async ({ jobId }) => {
      const job = await pact.jobs.get(BigInt(jobId));
      if (job.state !== JobState.Settled) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `job ${jobId} is in state ${JOB_STATE_LABEL[job.state]} (${job.state}); only Settled jobs (state=3) carry verifiable attestations`,
            },
          ],
        };
      }
      const service = await pact.services.get(job.serviceId);
      const verified = await pact.attestations.verify({
        text: job.attestationText,
        signature: job.attestationSignature,
        expectedSigner: service.signingAddress,
      });
      return {
        content: [
          {
            type: "text",
            text: jsonify({
              jobId,
              ok: verified.ok,
              recoveredSigner: verified.recoveredSigner,
              expectedSigner: verified.expectedSigner,
              note: verified.ok
                ? "Signature recovered to the same address PactRegistry.getService(serviceId) returns. Attestation is authentic."
                : "MISMATCH. Recovered signer does not match the registered signing address. This is a slashable event.",
            }),
          },
        ],
      };
    },
  );

  return server;
}

const app = express();

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID",
  );
  next();
});

app.options("*", (_req, res) => {
  res.status(204).end();
});

app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    service: "pact-mcp-http",
    network: "0g-mainnet",
    chainId: 16661,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    tools: [
      "list_services",
      "get_service",
      "get_job",
      "verify_attestation",
    ],
  });
});

app.get("/", (_req, res) => {
  res.type("text/plain").send(
    [
      "PACT MCP server over HTTP — 0G mainnet (chainId 16661).",
      "",
      "Endpoint: POST /mcp",
      "",
      "Add to your MCP client config:",
      `  { "mcpServers": { "trypact": { "url": "https://mcp.trypact.xyz/mcp" } } }`,
      "",
      "Read-only tools: list_services, get_service, get_job, verify_attestation.",
      "For the payment tool `run`, install @trypact/mcp-server locally:",
      "  npm i -g @trypact/mcp-server",
      "",
      "Source: https://github.com/winsznx/pact",
    ].join("\n"),
  );
});

/**
 * POST /mcp — every request builds a fresh McpServer + transport in
 * stateless mode. handleRequest forwards the JSON-RPC body to the
 * transport which routes to the registered tool handlers.
 */
app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[/mcp] handler error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : String(err),
        },
        id: null,
      });
    }
  }
});

/**
 * Stateless mode rejects GET and DELETE per MCP spec (no SSE notifications
 * from server, no session to terminate). Return 405 with a clear message.
 */
app.get("/mcp", (_req, res) => {
  res
    .status(405)
    .json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message:
          "Method Not Allowed. This server runs in stateless mode; use POST /mcp with a JSON-RPC payload.",
      },
      id: null,
    });
});

app.delete("/mcp", (_req, res) => {
  res
    .status(405)
    .json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message:
          "Method Not Allowed. This server runs in stateless mode; no session to terminate.",
      },
      id: null,
    });
});

app.listen(PORT, () => {
  console.log(
    `[pact-mcp-http] ready on :${PORT} — POST /mcp · 0G mainnet (16661)`,
  );
});
