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
    default: "MatrixGateway — Accept USDT Payments, Settle in Minutes",
    template: "%s · MatrixGateway",
  },
  description:
    "Crypto payment gateway for Indian businesses. Accept USDT on TRC-20, BEP-20, ERC-20 and Solana — hosted checkout, one-call REST API, signed IPN callbacks, 0.5% per settled payment.",
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
