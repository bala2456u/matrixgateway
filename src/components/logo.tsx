import Link from "next/link";

export function Logo({ href = "/", size = "md" }: { href?: string; size?: "md" | "lg" }) {
  const text = size === "lg" ? "text-2xl" : "text-lg";
  const box = size === "lg" ? "h-9 w-9 text-xl" : "h-7 w-7 text-base";
  return (
    <Link href={href} className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span
        className={`${box} grid place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 font-bold text-slate-950`}
      >
        M
      </span>
      <span className={`${text} text-slate-100`}>
        Matrix<span className="text-emerald-400">Gateway</span>
      </span>
    </Link>
  );
}
