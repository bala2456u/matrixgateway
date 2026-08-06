import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://matrixgateway.co.in"),
  title: {
    default: "MatrixGateway — Sell Crypto, Get INR Instantly",
    template: "%s · MatrixGateway",
  },
  description:
    "India's professional crypto off-ramp. Sell USDT, BTC, ETH and more — receive INR in your bank account within minutes via IMPS. KYC-compliant, TDS-ready.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const demo = process.env.GATEWAY_MODE !== "live";
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {demo && (
          <div className="sticky top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950">
            DEMO — this is a test environment. Deposit addresses are not real wallets and INR payouts
            are simulated. Do not send real crypto.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
