"use client";
import { KeyboardEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, X } from "lucide-react";
import type { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { CATEGORIES, NOTE_FIELDS } from "@/lib/constants";
import { interviewSchema } from "@/lib/validation";
import { Button, Card, Field, cx, inputCls, useToast } from "./ui";

type Parsed = z.infer<typeof interviewSchema>;
export type FormState = Omit<Parsed, "category"> & { category: Parsed["category"] | "" };

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const emptyForm = (): FormState => ({
  research_id: "", participant_name: "", phone: "", consent_feedback: false, consent_identity: false,
  products_used: [], category: "", purchase_motivation: "", liked: "", disliked: "", difficulties: "",
  expectations: "", incidents: "", observations: "", interview_date: today(), status: "draft",
});
export const toForm = (r: any): FormState => ({
  research_id: r.research_id, participant_name: r.participant_name ?? "", phone: r.phone ?? "",
  consent_feedback: r.consent_feedback, consent_identity: r.consent_identity, products_used: r.products_used ?? [],
  category: r.category, purchase_motivation: r.purchase_motivation, liked: r.liked, disliked: r.disliked,
  difficulties: r.difficulties, expectations: r.expectations, incidents: r.incidents, observations: r.observations,
  interview_date: r.interview_date, status: r.status,
});

function Products({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim().replace(/,$/, "");
    if (v && !value.includes(v) && value.length < 20) onChange([...value, v]);
    setDraft("");
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
  };
  return (
    <Field label="Products used" hint="Type a product and press Enter." error={error}>
      <div className={cx(inputCls(!!error), "flex flex-wrap gap-1.5")}>
        {value.map((p) => (
          <span key={p} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            {p}<button type="button" aria-label={`Remove ${p}`} onClick={() => onChange(value.filter((x) => x !== p))}><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={key} onBlur={add}
          className="min-w-[8rem] flex-1 bg-transparent outline-none" placeholder={value.length ? "" : "e.g. a product name"} />
      </div>
    </Field>
  );
}

export function InterviewForm({ mode, id, initial }: { mode: "create" | "edit"; id?: string; initial?: FormState }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<FormState>(() => initial ?? emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<"draft" | "completed" | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(status: "draft" | "completed") {
    const parsed = interviewSchema.safeParse({ ...f, status });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { const k = String(i.path[0] ?? "form"); if (!e[k]) e[k] = i.message; });
      setErrors(e); toast("error", "Please fix the problems listed above the buttons."); return;
    }
    setErrors({}); setSaving(status);
    try {
      const res = mode === "create"
        ? await api<{ id: string }>("/api/interviews", { method: "POST", json: parsed.data })
        : await api<{ id: string }>(`/api/interviews/${id}`, { method: "PUT", json: parsed.data });
      toast("success", status === "completed" ? "Interview saved and marked completed" : "Draft saved");
      router.push(`/interviews/${res.id}`); router.refresh();
    } catch (e) {
      const err = e as ApiError;
      const m: Record<string, string> = {};
      Object.entries(err.details ?? {}).forEach(([k, v]) => { if (v?.[0]) m[k] = v[0]; });
      if (!Object.keys(m).length) m.form = err.message;
      setErrors(m); toast("error", err.message);
    } finally { setSaving(null); }
  }

  return (
    <form className="max-w-3xl space-y-6" onSubmit={(e) => e.preventDefault()} noValidate>
      <Card className="space-y-4">
        <h2 className="font-semibold">Interview details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer research ID" hint="Your own code, e.g. MM-001. Do not use a real name." error={errors.research_id}>
            <input className={inputCls(!!errors.research_id)} value={f.research_id} onChange={(e) => set("research_id", e.target.value)} />
          </Field>
          <Field label="Interview date" error={errors.interview_date}>
            <input type="date" className={inputCls(!!errors.interview_date)} value={f.interview_date} onChange={(e) => set("interview_date", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 border-slate-300 bg-slate-50">
        <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-slate-500" /><h2 className="font-semibold">Private participant details</h2></div>
        <p className="text-sm text-slate-500">Stored privately. Never sent to the AI provider, never logged, and phone numbers are never exported.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Participant name" error={errors.participant_name}><input className={inputCls(!!errors.participant_name)} autoComplete="off" value={f.participant_name} onChange={(e) => set("participant_name", e.target.value)} /></Field>
          <Field label="Phone number" error={errors.phone}><input className={inputCls(!!errors.phone)} inputMode="tel" autoComplete="off" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /><h2 className="font-semibold">Consent (two separate permissions)</h2></div>
        {([
          ["consent_feedback", "1. Consent to participate and share feedback", "The participant agreed to be interviewed and for their feedback to be used in this research and shared with Mosaic. Without this, the interview is excluded from AI analysis and from the report."],
          ["consent_identity", "2. Consent to share identity with Mosaic", "A separate permission: the participant agreed that their name may be revealed to Mosaic. Without it they stay anonymous in exports."],
        ] as const).map(([k, title, body]) => (
          <label key={k} className={cx("flex cursor-pointer gap-3 rounded-xl border p-4", f[k] ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200", errors[k] && "border-red-400")}>
            <input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-600" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />
            <span><span className="block text-sm font-medium">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{body}</span>
              {errors[k] && <span className="mt-1 block text-xs font-medium text-red-600">{errors[k]}</span>}</span>
          </label>
        ))}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Products</h2>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">Product category</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => (
              <label key={c} className={cx("cursor-pointer rounded-xl border p-3 text-center text-sm font-medium transition", f.category === c ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:bg-slate-50")}>
                <input type="radio" name="category" className="sr-only" checked={f.category === c} onChange={() => set("category", c)} />{c}
              </label>
            ))}
          </div>
          {errors.category && <p className="mt-1 text-xs font-medium text-red-600">{errors.category}</p>}
        </fieldset>
        <Products value={f.products_used} onChange={(v) => set("products_used", v)} error={errors.products_used} />
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold">What the customer said</h2>
          <p className="text-sm text-slate-500">Record what they actually said or did. Avoid typing names or phone numbers in these notes.</p>
        </div>
        {NOTE_FIELDS.map(([k, label]) => (
          <Field key={k} label={label} error={errors[k]}>
            <textarea rows={3} className={inputCls(!!errors[k])} value={f[k]} onChange={(e) => set(k, e.target.value)} maxLength={4000} />
          </Field>
        ))}
      </Card>

      {Object.keys(errors).length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Please fix:</p>
          <ul className="mt-1 list-disc pl-5">{Object.values(errors).map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={saving === "draft"} disabled={!!saving} onClick={() => submit("draft")}>Save as draft</Button>
        <Button loading={saving === "completed"} disabled={!!saving} onClick={() => submit("completed")}>Save and mark completed</Button>
        <Button variant="ghost" disabled={!!saving} onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
