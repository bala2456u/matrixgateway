import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button, Card } from "@/components/ui";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getRates } from "@/lib/rates";
import { formatInr } from "@/lib/fees";
import {
  Zap,
  ShieldCheck,
  Landmark,
  FileCheck2,
  Webhook,
  LockKeyhole,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  const assets = await prisma.asset.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
  const { rates } = await getRates(assets.map((a) => a.coingeckoId));

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[32rem] w-[60rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 top-96 h-96 w-96 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-3">
          {session ? (
            <Link href={session.role === "ADMIN" ? "/admin" : "/dashboard"}>
              <Button>
                Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/signup">
                <Button>Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6">
        <section className="pt-20 pb-16 text-center">
          <p className="mx-auto w-fit rounded-full border border-emerald-800/60 bg-emerald-950/40 px-4 py-1.5 text-xs font-medium text-emerald-300">
            Crypto off-ramp for India · IMPS payouts · TDS handled
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-slate-100">
            Sell crypto. Get <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">INR in minutes</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            MatrixGateway converts your USDT, BTC, ETH and SOL to Indian Rupees at live market rates —
            settled straight to your bank account by IMPS, with KYC and 1% TDS compliance built in.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg">
                Start selling <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how">
              <Button variant="secondary" size="lg">
                How it works
              </Button>
            </Link>
          </div>
        </section>

        <section className="pb-16">
          <Card className="mx-auto max-w-3xl">
            <div className="grid grid-cols-4 divide-x divide-slate-800">
              {assets.map((a) => (
                <div key={a.id} className="px-6 py-5 text-center">
                  <p className="text-sm font-semibold text-slate-300">{a.symbol}</p>
                  <p className="mt-1 font-mono text-sm text-emerald-300">
                    {rates[a.coingeckoId] ? formatInr(rates[a.coingeckoId]) : "—"}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <p className="mt-2 text-center text-xs text-slate-600">Live market rates, locked for 10 minutes per order</p>
        </section>

        <section id="how" className="pb-20">
          <h2 className="text-center text-2xl font-semibold text-slate-100">Three steps to INR</h2>
          <div className="mt-8 grid grid-cols-3 gap-5">
            {[
              {
                n: "01",
                t: "Lock a live rate",
                d: "Pick your asset and amount. We lock the market rate for 10 minutes with a transparent fee breakdown.",
              },
              {
                n: "02",
                t: "Send your crypto",
                d: "Transfer to your unique deposit address. Our watcher tracks the transaction to confirmation.",
              },
              {
                n: "03",
                t: "INR hits your bank",
                d: "The moment your deposit confirms, an IMPS payout fires to your linked account with a UTR you can track.",
              },
            ].map((s) => (
              <Card key={s.n} className="p-6">
                <p className="font-mono text-sm text-emerald-500">{s.n}</p>
                <h3 className="mt-2 font-semibold text-slate-100">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.d}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <h2 className="text-center text-2xl font-semibold text-slate-100">Built like a payments company</h2>
          <div className="mt-8 grid grid-cols-3 gap-5">
            {[
              { icon: Zap, t: "Instant IMPS payouts", d: "Settlement fires automatically on chain confirmation — no manual step, 24×7." },
              { icon: ShieldCheck, t: "KYC & PMLA aligned", d: "PAN-based identity verification with an auditable review trail before any rupee moves." },
              { icon: FileCheck2, t: "TDS handled for you", d: "1% TDS under Section 194S computed and itemised on every order, ready for filings." },
              { icon: LockKeyhole, t: "Security first", d: "Hashed credentials, signed sessions, rate limiting, audit logs, and least-privilege admin." },
              { icon: Webhook, t: "Developer platform", d: "REST API with scoped keys and HMAC-signed webhooks — integrate the off-ramp into your app." },
              { icon: Landmark, t: "Transparent fees", d: "One flat 0.5% platform fee. Every deduction itemised before you commit." },
            ].map(({ icon: Icon, t, d }) => (
              <Card key={t} className="p-6">
                <Icon className="h-5 w-5 text-emerald-400" />
                <h3 className="mt-3 font-semibold text-slate-100">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{d}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="pb-24">
          <Card className="mx-auto max-w-3xl border-emerald-800/40 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-10 text-center">
            <h2 className="text-2xl font-semibold text-slate-100">Ready to off-ramp?</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
              Create an account, verify KYC in minutes, and sell your first crypto today.
            </p>
            <Link href="/signup" className="mt-6 inline-block">
              <Button size="lg">
                Create free account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-800/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-slate-500">
          <p>© 2026 MatrixGateway · Sandbox environment — no real funds move.</p>
          <p>
            A production deployment requires FIU-IND registration as a VDA service provider and a licensed payout
            partner.
          </p>
        </div>
      </footer>
    </div>
  );
}
