"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null); setInfo(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    const sb = createClient();
    const { data, error } = mode === "in"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (mode === "up" && !data.session) { setInfo("Check your inbox to confirm your email, then sign in."); return; }
    router.replace("/"); router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-7 shadow-2xl">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Mosaic Fellowship</div>
          <h1 className="mt-1 text-xl font-semibold">Customer Intelligence Hub</h1>
          <p className="mt-1 text-sm text-slate-500">Private research workspace. Sign in to continue.</p>
        </div>
        <Field label="Email"><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls()} /></Field>
        <Field label="Password"><input type="password" required autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls()} /></Field>
        {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
        {info && <p className="rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-700">{info}</p>}
        <Button type="submit" loading={loading} className="w-full">{mode === "in" ? "Sign in" : "Create account"}</Button>
        <button type="button" className="w-full text-center text-sm text-slate-500 hover:text-slate-800" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
