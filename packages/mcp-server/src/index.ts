/**
 * @trypact/mcp-server — MCP server exposing the PACT buyer SDK as tools
 * any MCP-compatible AI agent (Claude Desktop, Cursor, Cline, Continue,
 * Windsurf, etc.) can call directly via stdio.
 *
 * Five tools:
 *   - pact.list_services       : browse the registry (read-only)
 *   - pact.get_service         : fetch one service by id (read-only)
 *   - pact.get_job             : fetch one job by id (read-only)
 *   - pact.verify_attestation  : local ECDSA recovery on a settled job (read-only)
 *   - pact.run                 : escrow funds, watch through settlement,
 *                                verify attestation, return the output
 *                                (write — requires PACT_PRIVATE_KEY env)
 *
 * Install / configure:
 *   In ~/.claude/mcp.json (Claude Desktop) or ~/.cursor/mcp.json:
 *
 *     {
 *       "mcpServers": {
 *         "trypact": {
 *           "command": "npx",
 *           "args": ["-y", "@trypact/mcp-server"],
 *           "env": { "PACT_PRIVATE_KEY": "0x..." }
 *         }
 *       }
 *     }
 *
 * Then restart the agent. Tools appear under the `trypact` namespace.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { PactClient, JobState, JOB_STATE_LABEL } from "@trypact/sdk";

const ogMainnet = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: [process.env.PACT_RPC_URL ?? "https://evmrpc.0g.ai"] } },
  blockExplorers: {
    default: { name: "0G ChainScan", url: "https://chainscan.0g.ai" },
  },
});

const publicClient: PublicClient = createPublicClient({
  chain: ogMainnet,
  transport: http(undefined, { batch: true, retryCount: 2 }),
});

/**
 * Wallet client is constructed only if PACT_PRIVATE_KEY is set. Read-only
 * tools work without it. Write tools (pact.run) refuse with a clear
 * error message when the key is missing.
 */
let walletClient: WalletClient | undefined;
const privateKey = process.env.PACT_PRIVATE_KEY;
if (privateKey && /^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  walletClient = createWalletClient({
    account,
    chain: ogMainnet,
    transport: http(undefined, { retryCount: 2 }),
  });
}

const pact = new PactClient({ publicClient, walletClient });

const server = new McpServer({
  name: "trypact",
  version: "0.1.0",
});

/** Helper — stringify bigints so MCP's JSON serialization works. */
function jsonify(value: unknown): string {
  return JSON.stringify(
    value,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}

function buyerWalletAddress(): string {
  return walletClient?.account?.address ?? "(no PACT_PRIVATE_KEY set)";
}

// ─────────────────────────────────────────────────────────────────────────
// Read-only tools — work without a private key.
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "list_services",
  "List every AI service registered on PACT (0G mainnet, chainId 16661). Returns service id, seller, model, signing address, price per call, registration timestamp. Use this to browse the marketplace before calling pact.run on a specific service.",
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
  "Fetch a single PACT service by id. Returns the same Service struct as list_services but for one record. Use this to confirm pricing + signing address before paying.",
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
  "Locally verify a settled PACT job's TEE attestation. Pure cryptography, no chain RPC. Runs EIP-191 + ECDSA secp256k1 recovery against the job's attestation bytes, compares the recovered signer to the service's registered signing address. Returns ok=true on match, ok=false otherwise.",
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
              : "MISMATCH. Recovered signer does not match the registered signing address. This is a slashable event — call PactEscrow.dispute(jobId).",
          }),
        },
      ],
    };
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Write tools — require PACT_PRIVATE_KEY in env.
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "run",
  "Pay a PACT service for ONE inference and return the verified output. Escrows the service's pricePerCall in 0G, polls until the job settles (~45 seconds on 0G mainnet), verifies the TEE attestation locally, returns the recovered signer + tx hash + job id. REQUIRES `PACT_PRIVATE_KEY` env var (a 0G mainnet burner with ≥0.005 $0G). Use list_services first to pick a serviceId.",
  {
    serviceId: z
      .string()
      .regex(/^\d+$/)
      .describe("Service id from list_services."),
    prompt: z
      .string()
      .min(1)
      .max(8192)
      .describe(
        "Plain text prompt sent to the agent. Capped at 8KB to match PactRegistry.maxInputBytes for v0.1 services.",
      ),
    timeoutSec: z
      .number()
      .int()
      .min(60)
      .max(3600)
      .optional()
      .describe(
        "Optional job timeout in seconds. Defaults to 300 (5 min). Buyer reclaims escrow if seller hasn't attested by this deadline.",
      ),
  },
  async ({ serviceId, prompt, timeoutSec }) => {
    if (!walletClient) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              "pact.run requires a buyer wallet — set `PACT_PRIVATE_KEY` (0x-prefixed 32-byte hex) in the MCP server env. " +
              "Example ~/.claude/mcp.json: { \"mcpServers\": { \"trypact\": { \"command\": \"npx\", \"args\": [\"-y\", \"@trypact/mcp-server\"], \"env\": { \"PACT_PRIVATE_KEY\": \"0x...\" } } } }",
          },
        ],
      };
    }
    const result = await pact.run({
      serviceId: BigInt(serviceId),
      prompt,
      ...(timeoutSec !== undefined ? { timeoutSec } : {}),
    });
    return {
      content: [
        {
          type: "text",
          text: jsonify({
            jobId: result.jobId,
            verified: result.verified,
            txHashes: result.txHashes,
            createJobChainscan: `https://chainscan.0g.ai/tx/${result.txHashes.createJob}`,
            service: {
              id: result.service.serviceId,
              modelId: result.service.modelId,
              signingAddress: result.service.signingAddress,
            },
            attestation: {
              textBytes: result.attestation.text.length,
              signatureBytes: result.attestation.signature.length,
            },
            buyer: buyerWalletAddress(),
            note: result.verified.ok
              ? `Settled. Recovered signer matches registered signing key — attestation is authentic. Output bytes available via pact.get_job(${result.jobId}).outputRootHash.`
              : `Settled but signature MISMATCH — recovered ${result.verified.recoveredSigner} vs expected ${result.verified.expectedSigner}. This is a slashable event.`,
          }),
        },
      ],
    };
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Boot.
// ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Per MCP convention, log to stderr (stdio is reserved for the protocol).
  console.error(
    `@trypact/mcp-server ready. Network=0g-mainnet (16661). ` +
      `Buyer wallet: ${buyerWalletAddress()}`,
  );
}

main().catch((err) => {
  console.error("@trypact/mcp-server fatal:", err);
  process.exit(1);
});
