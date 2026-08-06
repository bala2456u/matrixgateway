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
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
