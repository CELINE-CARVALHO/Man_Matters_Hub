"use client";
import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode, createContext, useCallback, useContext, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import type { Ev } from "@/lib/types";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const variants = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
  ghost: "text-slate-600 hover:bg-slate-100",
};
export const btn = (v: keyof typeof variants = "primary", extra = "") =>
  cx("inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50", variants[v], extra);

export function Button({ variant = "primary", loading, className, children, disabled, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; loading?: boolean }) {
  return (
    <button {...p} disabled={disabled || loading} className={btn(variant, className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  );
}
export function ButtonLink({ href, variant = "primary", children, target }: { href: string; variant?: keyof typeof variants; children: ReactNode; target?: string }) {
  return <Link href={href} target={target} className={btn(variant)}>{children}</Link>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</section>;
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

const tones = {
  slate: "bg-slate-100 text-slate-700", green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200", red: "bg-red-50 text-red-700 ring-1 ring-red-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
};
export const Badge = ({ tone = "slate", children }: { tone?: keyof typeof tones; children: ReactNode }) =>
  <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
export const Observed = () => <Badge tone="green">Observed evidence</Badge>;
export const Hypothesis = () => <Badge tone="amber">Hypothesis</Badge>;

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 rounded-full bg-indigo-50 p-3 text-indigo-600">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export const Loading = () => <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && <button onClick={onRetry} className="font-medium underline">Retry</button>}
    </div>
  );
}

export const inputCls = (err?: boolean) =>
  cx("w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2",
    err ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200");

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export function Evidence({ items }: { items: Ev[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((e, i) => (
        <li key={i} className="rounded-lg border-l-2 border-emerald-400 bg-emerald-50/60 px-3 py-1.5 text-sm text-slate-700">
          “{e.quote}” <span className="ml-1 rounded bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">{e.ref}</span>
        </li>
      ))}
    </ul>
  );
}

type T = { id: number; kind: "success" | "error"; text: string };
const ToastCtx = createContext<(kind: T["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: T["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className={cx("flex items-start gap-2 rounded-xl border bg-white p-3 text-sm shadow-lg", t.kind === "error" ? "border-red-200" : "border-emerald-200")}>
            {t.kind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 text-red-500" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />}
            <span className="flex-1 text-slate-700">{t.text}</span>
            <button onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} aria-label="Dismiss"><X className="h-4 w-4 text-slate-400" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
