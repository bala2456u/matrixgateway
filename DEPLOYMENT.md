# Deploying MatrixGateway (Railway + GoDaddy)

Target: **matrixgateway.co.in** (primary), with `.in` and `.info` redirecting to it.

> **Deploy in private-preview mode.** INR payouts are still simulated. The steps below keep
> `LIVE_NETWORKS` empty and an `ACCESS_CODE` gate on, so the site is reachable at your domain
> but no stranger can send real crypto and receive a fake "₹ credited" screen.

---

## 1. Push the code to GitHub

```bash
git init
git add .
git commit -m "MatrixGateway crypto off-ramp"
gh repo create matrixgateway --private --source=. --push
```

`.env` is gitignored — verify with `git status` that it is **not** staged before pushing.

## 2. Create the Railway project

1. railway.app → **New Project** → **Deploy from GitHub repo** → pick `matrixgateway`
2. In the project, **+ New** → **Database** → **PostgreSQL**
3. Open the web service → **Variables** → paste the values from `.env.production.example`,
   replacing every `CHANGE_ME`. Generate the session secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   `DATABASE_URL` must be the literal reference `${{Postgres.DATABASE_URL}}` so Railway injects it.
4. Deploy. `npm run start` runs `prisma migrate deploy` first, so the schema is created automatically.
5. Seed the assets and admin user once, from the service's **Shell**:

   ```bash
   npx prisma db seed
   ```

6. Check `https://<your-app>.up.railway.app/api/health` → should return `{"status":"ok"}`.

## 3. Point the domain at Railway

In Railway: **Settings → Networking → Custom Domain** → add `matrixgateway.co.in` and
`www.matrixgateway.co.in`. Railway shows a CNAME target like `xxxx.up.railway.app` — use it below.

### GoDaddy DNS records (Domain → DNS → Manage Zones)

| Type | Name | Value | TTL |
|---|---|---|---|
| CNAME | `www` | `xxxx.up.railway.app` (from Railway) | 600 |
| A or CNAME | `@` | see note | 600 |

GoDaddy does not support a true CNAME at the root (`@`). Two options:

- **Recommended:** use Railway's **A record** target for the root if offered, or
- Set the root to **Forward to** `https://www.matrixgateway.co.in` (GoDaddy → Domain Settings →
  Forwarding), and serve the site from `www`.

Cleanest alternative: move DNS to Cloudflare (free) which supports CNAME flattening at the root,
then point `@` straight at the Railway hostname.

SSL is issued automatically by Railway once DNS resolves — allow 5–30 minutes.

### Redirect the other two domains

GoDaddy → `matrixgateway.in` and `matrixgateway.info` → **Forwarding** →
forward to `https://matrixgateway.co.in` with **301 permanent** + forward masking **off**.

## 4. After the first login

1. Log in as `admin@matrixgateway.co.in` with `SEED_ADMIN_PASSWORD` and **change the password**.
2. **Admin → Wallets**: leave gateway addresses **blank** while in private preview. Filling them in
   plus setting `LIVE_NETWORKS` makes the gateway accept real crypto.

---

## Going fully public later

Only after you have (a) a licensed INR payout partner wired into `src/lib/orders.ts` replacing the
simulated payout, and (b) FIU-IND registration as a VDA service provider:

1. Remove `ACCESS_CODE` from Railway variables (opens the site).
2. Set `LIVE_NETWORKS="BEP20,TRC20"` and fill the gateway wallets in Admin → Wallets.
3. Replace `SANDBOX_AUTO_PAY_SECONDS` handling by setting `GATEWAY_MODE="live"`.

See the production checklist at the bottom of [README.md](README.md).
