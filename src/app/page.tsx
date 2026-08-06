import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button, Card } from "@/components/ui";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getRates } from "@/lib/rates";
import { getSettings } from "@/lib/settings";
import { formatInr } from "@/lib/fees";
import {
  Zap,
  ShieldCheck,
  Webhook,
  Code2,
  Link2,
  Wallet,
  ArrowRight,
  Check,
  IndianRupee,
  Globe2,
  LockKeyhole,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  const [networks, asset, settings] = await Promise.all([
    prisma.assetNetwork.findMany({
      where: { enabled: true, asset: { symbol: "USDT" } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.asset.findUnique({ where: { symbol: "USDT" } }),
    getSettings(),
  ]);
  const { rates } = await getRates(asset ? [asset.coingeckoId] : []);
  const usdtInr = asset ? rates[asset.coingeckoId] : undefined;
  const feePct = Number(settings.service_fee_bps) / 100;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-52 left-1/2 h-[34rem] w-[64rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
          <a href="#how" className="hover:text-slate-200">How it works</a>
          <a href="#features" className="hover:text-slate-200">Features</a>
          <a href="#pricing" className="hover:text-slate-200">Pricing</a>
          <a href="#developers" className="hover:text-slate-200">Developers</a>
        </nav>
        <div className="flex items-center gap-3">
          {session ? (
            <Link href={session.role === "ADMIN" ? "/admin" : "/dashboard"}>
              <Button>Dashboard <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost">Sign in</Button></Link>
              <Link href="/signup"><Button>Get started</Button></Link>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="pt-20 pb-14 text-center">
          <p className="mx-auto w-fit rounded-full border border-emerald-800/60 bg-emerald-950/40 px-4 py-1.5 text-xs font-medium text-emerald-300">
            USDT payments · TRC-20 · BEP-20 · ERC-20 · Solana
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight text-slate-100">
            Accept USDT payments,{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              settle in minutes
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            A crypto payment gateway built for Indian businesses. Generate a payment link or call one API
            endpoint — your customer pays USDT, you get confirmed settlement and a signed callback.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg">Start accepting USDT <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <a href="#developers"><Button variant="secondary" size="lg">Read the API docs</Button></a>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            No setup fee · No monthly fee · {feePct}% per settled payment
          </p>
        </section>

        {/* Networks strip */}
        <section className="pb-16">
          <Card className="mx-auto max-w-3xl">
            <div className="grid grid-cols-2 divide-slate-800 sm:grid-cols-4 sm:divide-x">
              {networks.map((n) => (
                <div key={n.id} className="px-6 py-5 text-center">
                  <p className="text-sm font-semibold text-slate-200">{n.code}</p>
                  <p className="mt-1 text-xs text-slate-500">{n.name}</p>
                  <p className="mt-1.5 text-xs text-emerald-400">~{n.avgSettleMinutes} min</p>
                </div>
              ))}
            </div>
          </Card>
          {usdtInr && (
            <p className="mt-2 text-center text-xs text-slate-600">
              Live rate: 1 USDT = {formatInr(usdtInr)} · locked for the life of each payment
            </p>
          )}
        </section>

        {/* How it works */}
        <section id="how" className="pb-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-slate-100">
            Three steps to your first payment
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { n: "01", icon: Link2, t: "Create a payment", d: "Generate a payment link from the dashboard, or POST one request to /api/v1/payment from your backend." },
              { n: "02", icon: Wallet, t: "Customer pays USDT", d: "They get a hosted checkout with a QR, the exact amount and a countdown. Works with any wallet." },
              { n: "03", icon: Zap, t: "You get settled", d: "We watch the chain, confirm the transfer, credit your balance and fire a signed IPN callback." },
            ].map(({ n, icon: Icon, t, d }) => (
              <Card key={n} className="p-6">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-emerald-400" />
                  <span className="font-mono text-sm text-emerald-500/70">{n}</span>
                </div>
                <h3 className="mt-3 font-semibold text-slate-100">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{d}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="pb-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-slate-100">
            Everything a payments team needs
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: Zap, t: "Real-time confirmation", d: "We poll the chain directly and count real block confirmations — no manual reconciliation." },
              { icon: Webhook, t: "Signed IPN callbacks", d: "HMAC-SHA512 signatures on every status change, with automatic retries until your endpoint acknowledges." },
              { icon: Link2, t: "Hosted checkout", d: "Branded payment pages with your name and colour. No integration required to start selling." },
              { icon: Code2, t: "Clean REST API", d: "Create payments, poll status, estimate prices and query minimums. Bearer-key auth, JSON everywhere." },
              { icon: ShieldCheck, t: "Overpayment handling", d: "Unique cent-coded amounts identify every payer, and overpayments are credited in full automatically." },
              { icon: IndianRupee, t: "INR-native pricing", d: "Price in rupees, get paid in USDT at the rate locked when the payment was created." },
            ].map(({ icon: Icon, t, d }) => (
              <Card key={t} className="p-6">
                <Icon className="h-5 w-5 text-emerald-400" />
                <h3 className="mt-3 font-semibold text-slate-100">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{d}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="pb-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-slate-100">
            One rate. No surprises.
          </h2>
          <Card className="mx-auto mt-10 max-w-md border-emerald-800/40 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-8 text-center">
            <p className="text-sm font-medium text-emerald-300">Pay as you go</p>
            <p className="mt-3 text-5xl font-semibold text-slate-100">{feePct}%</p>
            <p className="mt-1 text-sm text-slate-400">per settled payment</p>
            <ul className="mt-6 space-y-2.5 text-left text-sm text-slate-300">
              {[
                "No setup or monthly fees",
                "Unlimited payment links",
                "All four USDT networks",
                "Signed IPN callbacks + retries",
                "Full REST API and dashboard",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="mt-7 block">
              <Button size="lg" className="w-full">Create a free account</Button>
            </Link>
            <p className="mt-3 text-xs text-slate-500">Network gas fees are paid by the sender.</p>
          </Card>
        </section>

        {/* Developers */}
        <section id="developers" className="pb-20">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-100">
                Integrate in one request
              </h2>
              <p className="mt-4 text-slate-400">
                Create a payment from your backend, show the address and amount we return, and wait for the
                callback. That&apos;s the whole integration.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {[
                  { icon: LockKeyhole, t: "Bearer API keys, hashed at rest" },
                  { icon: Globe2, t: "Four networks behind one endpoint" },
                  { icon: Webhook, t: "Idempotent, retried callbacks" },
                ].map(({ icon: Icon, t }) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-emerald-400" /> {t}
                  </li>
                ))}
              </ul>
              <Link href="/docs" className="mt-7 inline-block">
                <Button variant="secondary">Full API reference <ArrowRight className="h-4 w-4" /></Button>
              </Link>
            </div>
            <Card className="overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-slate-800 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                <span className="ml-2 font-mono text-xs text-slate-500">create-payment.sh</span>
              </div>
              <pre className="overflow-x-auto px-5 py-4 font-mono text-[11px] leading-relaxed text-slate-300">
{`curl -X POST https://matrixgateway.co.in/api/v1/payment \\
  -H "Authorization: Bearer mg_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "price_amount": 2500,
    "price_currency": "INR",
    "network": "TRC20",
    "order_id": "ORD-1042",
    "ipn_callback_url": "https://you.com/ipn"
  }'

{
  "payment_id": "4823910576",
  "payment_status": "waiting",
  "pay_address": "TBTgpq65Pmsp9buTDg88Y2VN...",
  "pay_amount": 26.2841,
  "pay_currency": "usdt",
  "network": "TRC20",
  "outcome_amount": 26.1527
}`}
              </pre>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-24">
          <Card className="mx-auto max-w-3xl border-emerald-800/40 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-10 text-center">
            <h2 className="text-2xl font-semibold text-slate-100">Start accepting USDT today</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
              Create an account, generate a payment link, and take your first payment in minutes.
            </p>
            <Link href="/signup" className="mt-6 inline-block">
              <Button size="lg">Get started free <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </Card>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-800/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 MatrixGateway · Test environment — INR payouts are simulated.</p>
          <p>
            A production launch requires FIU-IND registration as a VDA service provider and a licensed
            payout partner.
          </p>
        </div>
      </footer>
    </div>
  );
}
