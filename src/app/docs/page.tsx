import Link from "next/link";
import { Logo } from "@/components/logo";
import { Card, Badge } from "@/components/ui";
import { baseUrl } from "@/lib/urls";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "API reference",
  description: "MatrixGateway REST API — accept USDT payments on TRC-20, BEP-20, ERC-20 and Solana.",
};

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/status", desc: "Health probe.", auth: false },
  { method: "GET", path: "/api/v1/currencies", desc: "Supported USDT networks.", auth: false },
  { method: "GET", path: "/api/v1/estimate", desc: "Convert a fiat amount to USDT. Params: amount, currency_from, currency_to.", auth: false },
  { method: "GET", path: "/api/v1/min-amount", desc: "Minimum accepted payment. Param: fiat_equivalent.", auth: false },
  { method: "POST", path: "/api/v1/payment", desc: "Create a payment.", auth: true },
  { method: "GET", path: "/api/v1/payment", desc: "List payments. Params: limit, page, status, orderBy.", auth: true },
  { method: "GET", path: "/api/v1/payment/{payment_id}", desc: "Fetch one payment's current status.", auth: true },
  { method: "POST", path: "/api/v1/invoice", desc: "Create a hosted payment link.", auth: true },
];

const STATUSES = [
  ["waiting", "Created, awaiting the customer's transfer."],
  ["confirming", "Transfer seen on-chain, accumulating confirmations."],
  ["confirmed", "Enough confirmations reached."],
  ["sending", "Crediting the merchant balance."],
  ["finished", "Complete. Funds credited."],
  ["partially_paid", "Customer sent less than the expected amount."],
  ["expired", "No transfer arrived within the payment window."],
  ["failed", "Payment could not be completed."],
];

export default async function DocsPage() {
  const origin = baseUrl();
  const settings = await getSettings();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Logo />
        <Link href="/dashboard/developer" className="text-sm text-emerald-400 hover:text-emerald-300">
          Get your API key →
        </Link>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-6 pb-24">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">API reference</h1>
          <p className="mt-2 text-slate-400">
            Accept USDT on TRC-20, BEP-20, ERC-20 and Solana. Base URL{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-sm text-emerald-300">{origin}</code>
          </p>
        </div>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-100">Authentication</h2>
          <p className="mt-2 text-sm text-slate-400">
            Every authenticated endpoint takes a bearer key from{" "}
            <Link href="/dashboard/developer" className="text-emerald-400 hover:underline">
              Dashboard → Developers
            </Link>
            . Keys are hashed at rest and shown once.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-xs text-slate-300">
{`Authorization: Bearer mg_live_xxxxxxxxxxxxxxxxxxxx`}
          </pre>
        </Card>

        <Card>
          <div className="border-b border-slate-800 px-6 py-4">
            <h2 className="font-semibold text-slate-100">Endpoints</h2>
          </div>
          <ul className="divide-y divide-slate-800/70">
            {ENDPOINTS.map((e) => (
              <li key={`${e.method}${e.path}`} className="flex items-start gap-3 px-6 py-3.5">
                <span
                  className={`mt-0.5 rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                    e.method === "GET" ? "bg-blue-500/15 text-blue-300" : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {e.method}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-slate-200">{e.path}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{e.desc}</p>
                </div>
                {e.auth && <Badge>auth</Badge>}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-100">Create a payment</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-300">
{`POST ${origin}/api/v1/payment

{
  "price_amount": 2500,          // required
  "price_currency": "INR",       // INR | USD | USDT
  "network": "TRC20",            // TRC20 | BEP20 | ERC20 | SOL (optional)
  "order_id": "ORD-1042",        // your reference
  "order_description": "Pro plan",
  "ipn_callback_url": "https://you.com/ipn",
  "success_url": "https://you.com/thanks",
  "cancel_url": "https://you.com/cart"
}

→ 201
{
  "payment_id": "4823910576",
  "payment_status": "waiting",
  "pay_address": "TBTgpq65...",
  "pay_amount": 26.2841,         // send EXACTLY this
  "pay_currency": "usdt",
  "network": "TRC20",
  "confirmations_required": 1,
  "service_fee": 0.1314,
  "outcome_amount": 26.1527,     // credited to you
  "expiration_estimate_date": "2026-08-07T12:34:56.000Z"
}`}
          </pre>
          <p className="mt-3 text-xs text-slate-500">
            <strong className="text-slate-400">Important:</strong> <code className="font-mono">pay_amount</code>{" "}
            carries a unique cent code that identifies the payer on a shared wallet. The customer must send that
            exact figure. Overpayments are credited in full; underpayments beyond{" "}
            {Number(settings.underpayment_tolerance_bps) / 100}% are marked{" "}
            <code className="font-mono">partially_paid</code>.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-100">Payment statuses</h2>
          <dl className="mt-3 space-y-2">
            {STATUSES.map(([s, d]) => (
              <div key={s} className="flex gap-3 text-sm">
                <dt className="w-32 shrink-0 font-mono text-xs text-emerald-400">{s}</dt>
                <dd className="text-slate-400">{d}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-100">IPN callbacks</h2>
          <p className="mt-2 text-sm text-slate-400">
            On every status change we POST the payment object to your{" "}
            <code className="font-mono text-xs">ipn_callback_url</code>, signed with your IPN secret. Failed
            deliveries retry up to five times.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-300">
{`x-matrixgateway-sig: <hmac-sha512 hex>
x-matrixgateway-event: payment.finished

// signature = HMAC_SHA512(ipn_secret, JSON.stringify(sortKeys(body)))
// Always compare against your own computed value before trusting a callback.`}
          </pre>
          <Link href="/dashboard/settings" className="mt-3 inline-block text-sm text-emerald-400 hover:underline">
            Generate your IPN secret →
          </Link>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-slate-100">Hosted payment links</h2>
          <p className="mt-2 text-sm text-slate-400">
            No backend? Create a link in the dashboard, or via the API, and send it to your customer.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-[11px] text-slate-300">
{`POST ${origin}/api/v1/invoice
{ "price_amount": 999, "price_currency": "INR", "order_description": "Annual plan" }

→ { "invoice_url": "${origin}/pay/AbC123..." }`}
          </pre>
        </Card>
      </main>
    </div>
  );
}
