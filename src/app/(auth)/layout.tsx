import { Logo } from "@/components/logo";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>
      <div className="relative z-10 mb-8">
        <Logo size="lg" />
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
      <p className="relative z-10 mt-8 text-center text-xs text-slate-500">
        Sandbox environment · No real funds move ·{" "}
        <Link href="/" className="text-slate-400 underline-offset-2 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
