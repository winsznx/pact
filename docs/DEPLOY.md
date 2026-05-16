# Deploy guide — PACT web app

Reproducible Vercel deploy for `apps/web` in this pnpm monorepo.

---

## 1. Repo prerequisites

- Vercel CLI: `pnpm install -g vercel`
- Vercel account linked to the org/team that owns `trypact.xyz`
- Code pushed to a public GitHub repo (Vercel deploys from git)
- WalletConnect Cloud project at <https://cloud.walletconnect.com> — copy the **projectId** (a 32-hex string)

---

## 2. Vercel project setup

Vercel monorepo settings for this app (set on first `vercel link`, or via dashboard):

| Field | Value |
|---|---|
| **Root Directory** | `apps/web` |
| **Include source files outside of Root Directory** | **ON** *(required — Vercel must see `packages/shared` and `pnpm-workspace.yaml` at repo root)* |
| **Framework Preset** | Next.js (auto-detected) |
| **Node.js Version** | 20.x |
| **Install Command** | (overridden in `apps/web/vercel.json` to `cd ../.. && pnpm install --frozen-lockfile`) |
| **Build Command** | (overridden in `apps/web/vercel.json` to `cd ../.. && pnpm --filter @pact/web build`) |
| **Output Directory** | `.next` |
| **Regions** | `sin1` (Singapore — closest to 0G mainnet RPC for lowest latency) |

The [`apps/web/vercel.json`](../apps/web/vercel.json) already encodes the install + build commands + region. Dashboard settings only need Root Directory + the "include outside files" toggle.

---

## 3. Environment variables

Grep across `apps/web/src/` confirms three `NEXT_PUBLIC_*` vars consumed at runtime:

| Name | Required? | Prod value | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | **Yes** | *real projectId from cloud.walletconnect.com* | Without it, RainbowKit 2.2 hard-fails on connect. CHUNK 5 wired a known WC demo projectId as the fallback so localhost dev still works — production must use a real one tied to the trypact.xyz origin. |
| `NEXT_PUBLIC_DEMO_MOCK` | **No — DEV ONLY** | *(unset in production)* | When `1`, exposes `?demoAddress=…` and `?mockState=…` query overrides on `/seller` and `/verify/[jobId]` for screenshot capture without a connected wallet. **Never set this in Vercel production env** — it leaks the bypass surface to public traffic. |
| `NEXT_PUBLIC_ACTIVITY_REFETCH_MS` | No (defaults to `10000`) | `10000` or `30000` for production | `/explore` activity-feed poll interval. 10s on dev, can bump to 30s in production to be polite to the 0G RPC. |

Setting via CLI (run from `apps/web/`):

```bash
vercel env add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID production
# (paste the 32-hex projectId when prompted)

vercel env add NEXT_PUBLIC_ACTIVITY_REFETCH_MS production
# (enter 30000)
```

Do **not** add `NEXT_PUBLIC_DEMO_MOCK` to production env.

---

## 4. First deploy (staging on *.vercel.app)

```bash
cd apps/web
vercel link            # creates / associates Vercel project
vercel --prod          # deploys to <project>.vercel.app
```

Vercel prints the *.vercel.app URL. Save it — used as a fallback in the WC allow-list (PART 6 below).

### Smoke checks (curl)

```bash
URL=https://<your-vercel-url>
for p in / /marketplace /marketplace/1 /jobs/new /jobs/1 /verify/1 /explore /seller; do
  printf '%s ' "$(curl -s -o /dev/null -w '%{http_code}' "$URL$p")"
  echo "$p"
done
```

All 8 routes must return **200**.

### OG image probe

```bash
curl -I "$URL/opengraph-image"
# expect: HTTP/2 200, content-type: image/png
```

`/opengraph-image` is a generated 1200×630 PNG. Verify by opening it in a browser — should match the live landing visual identity (Instrument Serif headline + chartreuse pulse + live mainnet stats).

---

## 5. Custom domain `trypact.xyz`

After staging works, attach the apex domain + www:

```bash
vercel domains add trypact.xyz
vercel domains add www.trypact.xyz
```

Vercel prints the exact DNS records to set at your registrar. Typical shape:

| Type | Host | Value |
|---|---|---|
| A | `@` | `76.76.21.21` *(or whatever Vercel prints — use the printed value)* |
| CNAME | `www` | `cname.vercel-dns.com` |

Update DNS at your registrar (likely Namecheap, Cloudflare, etc.). SSL is auto-issued via Let's Encrypt once DNS propagates (5-30 min typical).

### Verify

```bash
dig +short trypact.xyz
dig +short www.trypact.xyz
curl -I https://trypact.xyz/
# Expect 200, valid SSL, all 8 routes accessible
```

---

## 6. WalletConnect Cloud allow-list

Login at <https://cloud.walletconnect.com>, find the project matching `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. In **Settings → Allowed Origins**, add:

- `https://trypact.xyz`
- `https://www.trypact.xyz`
- `https://<your-vercel-url>` *(fallback for preview deploys)*
- `http://localhost:3000` and `http://localhost:3001` *(dev)*

Save. Wait ~1 minute for cache. This kills the residual WC-analytics 404 noted in earlier chunks — production target after this step is **0 external errors**.

---

## 7. Post-deploy artifact updates

Once `https://trypact.xyz` resolves with HTTP 200:

- [`README.md`](../README.md) — status banner already references `https://trypact.xyz` (CHUNK 4 pre-wired); confirm the line is current
- [`docs/HACKQUEST_FORM.md`](./HACKQUEST_FORM.md) — Live URL field already at `https://trypact.xyz`; verify
- [`docs/X_POST.md`](./X_POST.md) — already uses `trypact.xyz`
- [`docs/DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) — references that should swap from `localhost:3001` to `https://trypact.xyz` for the recorded run *(see "Pre-flight checklist" section)*

---

## 8. Production smoke (browser)

Open `https://trypact.xyz` in incognito + devtools:

| Check | Expected |
|---|---|
| Console errors | **0** (WC analytics 404 gone after step 6) |
| HTTP requests | Zero to `fonts.googleapis.com` or `fonts.gstatic.com` (self-hosted per CHUNK 9.5) |
| Wallet pill | Renders "Connect" chartreuse pill |
| Connect → MetaMask flow | Triggers chain-switch prompt to 0G mainnet (16661) if on wrong chain |
| `/explore` feed | Shows 7 real on-chain events (REPUTATION_INCREMENT, ATTESTATION_VERIFIED, JOB_CREATED ×2, BOND_STAKED, SERVICE_REGISTERED, INFT_MINTED) |
| `/jobs/1` | Renders Pending state with elapsed/expired counter (CHUNK 5 fix in place) |
| `/marketplace/1` | Shows Service 1 live data + the AttestationReceipt fixture |
| `/seller` (connected as burner) | Dashboard with 1 service, 0.00095 $0G earned, bond locked |

OG image preview test (browser-side, no auth needed):
- `https://www.opengraph.xyz/url/https%3A%2F%2Ftrypact.xyz` — verify the 1200×630 PNG renders correctly across Twitter/Facebook/LinkedIn preview shapes

---

## 9. Rollback

Vercel deploys are immutable. To roll back:

```bash
vercel list           # show recent deployments
vercel rollback <url> # promote a prior deployment to production
```

Or in the dashboard → Deployments → … → Promote to Production.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails with `Cannot find module '@pact/shared'` | "Include source files outside Root Directory" toggle is **off** | Toggle on in Vercel dashboard → Settings → General |
| `pnpm: command not found` during build | Wrong Node version | Set Node.js 20.x; Corepack ships pnpm |
| Build hangs on font fetch | (Should not happen post-CHUNK 9.5) | Confirm `next/font/google` is not imported anywhere; `apps/web/src/app/layout.tsx` should use `next/font/local` only |
| Connect wallet button does nothing | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` missing or invalid | Re-add via `vercel env add`; redeploy |
| `/explore` feed empty | 0G RPC unreachable from Vercel edge | Switch deploy region (`sin1` is closest); inspect failed network requests in browser devtools |
| OG image returns 500 | `public/og-fonts/*.ttf` missing in deploy | Confirm `apps/web/public/og-fonts/` is committed and not gitignored |
