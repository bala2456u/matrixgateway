# MatrixGateway — Crypto → INR Off-Ramp Gateway

A professional crypto sell-side payment gateway for India: customers sell BTC / ETH / USDT / SOL at live
market rates and receive INR in their bank account via IMPS. Built with Next.js 16, TypeScript,
PostgreSQL (Prisma 7), and Tailwind CSS 4.

> **Sandbox mode** — the blockchain watcher and the IMPS payout rail are simulated so the entire
> product works locally with no real funds. The integration seams for real providers are marked below.

## Features

- **Customer dashboard** — KYC onboarding (PAN + Aadhaar last-4), bank accounts with IFSC → bank/branch
  auto-fill, sell wizard with a 10-minute rate lock, scan-to-pay QR codes, live status timeline, order history
- **Gateway wallet model** — the admin fixes one deposit address per network (Admin → Wallets);
  every order's QR pays that wallet and the sandbox watcher auto-confirms the payment with no clicks
- **Background settlement worker** — a server-side ticker advances every in-flight order
  (detection → confirmations → IMPS payout) even when no page is open
- **Rate engine** — live INR prices from CoinGecko (30s cache) with graceful offline fallback
- **Fee engine** — 0.5% platform fee + 1% TDS (Section 194S) itemised on every order
- **Order lifecycle** — `QUOTE → AWAITING_DEPOSIT → DEPOSIT_DETECTED → DEPOSIT_CONFIRMED → PAYOUT_PROCESSING → COMPLETED`
  (plus `EXPIRED` / `FAILED`), each transition recorded as an auditable event
- **Admin panel** — platform stats (volume, fee revenue, TDS withheld), KYC review queue,
  all orders, users, security audit log
- **Developer platform** — REST API v1 with hashed `mg_live_…` bearer keys,
  HMAC-SHA256-signed webhooks (Stripe-style `t=…,v1=…` signatures), delivery log
- **Security** — bcrypt (cost 12) password hashing, signed HttpOnly session JWTs, per-route
  rate limiting, Zod validation on every input, secrets shown once and stored hashed, audit logging

## Quick start

```bash
docker compose up -d          # PostgreSQL 16 on port 5433
npm install
npx prisma migrate dev        # apply schema
npx prisma db seed            # seed assets + admin (password printed once)
npm run dev
```

- App: http://localhost:3000 (or set `PORT`)
- Admin login: `admin@matrixgateway.co.in` — password printed by the seeder.
- Customer flow: sign up → KYC → (admin approves at `/admin/kyc`) → add bank → sell.
- In the deposit step, use **Simulate deposit** to emulate the on-chain transfer.

## Public API

```bash
# Live rates (public)
curl http://localhost:3000/api/v1/rates

# Create a sell order (auto-confirms against your default bank account)
# network is optional — defaults to the recommended one (TRC20 for USDT).
# USDT supports TRC20 | BEP20 | SOL | ERC20.
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer mg_live_..." \
  -H "Content-Type: application/json" \
  -d '{"asset": "USDT", "network": "TRC20", "amount": 100}'

# Fetch by reference
curl http://localhost:3000/api/v1/orders/MG-20260806-XXXXXX \
  -H "Authorization: Bearer mg_live_..."
```

API keys are created in **Dashboard → Developer** or via
`npx tsx scripts/create-api-key.ts user@example.com`.

Webhook events (`order.awaiting_deposit`, `order.deposit_detected`, `order.deposit_confirmed`,
`order.completed`) are signed:

```
X-MatrixGateway-Signature: t=<unix>,v1=HMAC_SHA256(secret, "<t>.<body>")
```

## Architecture

```
src/
  lib/
    orders.ts      # quote / confirm / lifecycle engine (sandbox settlement)
    rates.ts       # CoinGecko rate engine with cache + fallback
    fees.ts        # fee + TDS math
    webhooks.ts    # HMAC-signed dispatcher
    session.ts     # JWT cookie sessions (jose)
    apikeys.ts     # bearer-key auth for API v1
    ratelimit.ts   # sliding-window limiter
  app/
    (auth)/        # login, signup
    dashboard/     # customer app (sell wizard, orders, KYC, banks, developer)
    admin/         # ops panel (KYC queue, orders, users, audit)
    api/           # session APIs + public /api/v1
prisma/schema.prisma   # users, KYC, banks, orders, payouts, keys, webhooks, audit
```

## Going to production (the honest checklist)

Software alone does not make a legal off-ramp in India. Before touching real funds you need:

1. **FIU-IND registration** as a Virtual Digital Asset service provider (PMLA obligations,
   STR/CTR reporting, a designated compliance officer).
2. **A licensed payout partner** (e.g. a bank API or RBI-regulated PA/PG such as RazorpayX or
   Cashfree Payouts) — replace the sandbox settlement in `src/lib/orders.ts` (`advanceOrder`).
3. **Real custody + chain watching** — an HD wallet / custody provider (e.g. Fireblocks) and
   node/webhook infrastructure to detect deposits; replace `sandboxDepositAddress` and
   `simulateDeposit`.
4. **A liquidity venue** — exchange or OTC desk to convert received crypto to INR, with slippage
   and treasury management.
5. **Full KYC vendor** — PAN/Aadhaar verification APIs, liveness, sanctions screening
   (replace the manual admin approval).
6. **Tax rails** — actual TDS deposit against each PAN (Form 26Q), plus GST on fees.
7. **Hardening** — Redis-backed rate limiting, a real job queue for settlement/webhook retries,
   2FA, secrets management, penetration testing.
