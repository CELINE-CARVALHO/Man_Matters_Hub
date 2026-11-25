"use client";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Plus, Target } from "lucide-react";
import { api, ApiError, fetcher } from "@/lib/api";
import { WEIGHTS, priorityScore } from "@/lib/scoring";
import type { Problem, Settings } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorBox, Evidence, Field, Loading, PageHeader, inputCls, useToast } from "@/components/ui";

type Resp = { items: Problem[]; eligible_count: number; settings: Settings };
type Vals = { title: string; description: string; root_cause: string; recommendation: string; frequency_count: number; severity: number; customer_impact: number; tech_feasibility: number };
const blank: Vals = { title: "", description: "", root_cause: "", recommendation: "", frequency_count: 0, severity: 3, customer_impact: 3, tech_feasibility: 3 };

function Score({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (n: number) => void }) {
  return (
    <Field label={label} hint={hint}>
      <select className={inputCls()} value={value} onChange={(e) => onChange(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
    </Field>
  );
}

function ProblemForm({ initial, total, submitLabel, onSubmit }: { initial: Vals; total: number; submitLabel: string; onSubmit: (v: Vals) => Promise<void> }) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Vals>(k: K, x: Vals[K]) => setV((p) => ({ ...p, [k]: x }));
  async function go() {
    const e: Record<string, string> = {};
    if (v.title.trim().length < 3) e.title = "Give the problem a short title";
    if (!Number.isInteger(v.frequency_count) || v.frequency_count < 0 || v.frequency_count > total) e.frequency_count = `Enter 0 to ${total}`;
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { await onSubmit(v); } catch (x) { const a = x as ApiError; setErr({ title: a.details?.title?.[0] ?? a.message }); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <Field label="Problem" error={err.title}><input className={inputCls(!!err.title)} value={v.title} onChange={(e) => set("title", e.target.value)} /></Field>
      <Field label="Description"><textarea rows={2} className={inputCls()} value={v.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Frequency (interviews)" hint={`Out of ${total} eligible`} error={err.frequency_count}>
          <input type="number" min={0} max={total} className={inputCls(!!err.frequency_count)} value={v.frequency_count} onChange={(e) => set("frequency_count", Number(e.target.value))} /></Field>
        <Score label="Severity" hint="5 = very serious each time" value={v.severity} onChange={(n) => set("severity", n)} />
        <Score label="Customer impact" hint="5 = affects many/key moments" value={v.customer_impact} onChange={(n) => set("customer_impact", n)} />
        <Score label="Tech feasibility" hint="5 = easiest to solve with tech" value={v.tech_feasibility} onChange={(n) => set("tech_feasibility", n)} />
      </div>
      <Field label="Root cause (your hypothesis)"><textarea rows={2} className={inputCls()} value={v.root_cause} onChange={(e) => set("root_cause", e.target.value)} /></Field>
      <Field label="Recommended improvement"><textarea rows={2} className={inputCls()} value={v.recommendation} onChange={(e) => set("recommendation", e.target.value)} /></Field>
      <Button loading={busy} onClick={go}>{submitLabel}</Button>
    </div>
  );
}

export default function ProblemsPage() {
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<Resp>("/api/problems", fetcher);
  const [adding, setAdding] = useState(false);
  const [stmt, setStmt] = useState("");
  const [finalId, setFinalId] = useState("");
  const [savingFinal, setSavingFinal] = useState(false);
  useEffect(() => { if (data) { setStmt(data.settings.final_statement ?? ""); setFinalId(data.settings.final_problem_id ?? ""); } }, [data]);

  const total = data?.eligible_count ?? 0;
  const ranked = useMemo(() => (data?.items ?? []).map((p) => ({ ...p, score: priorityScore(p, total) })).sort((a, b) => b.score - a.score), [data, total]);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={error?.message ?? "Could not load problems."} onRetry={() => mutate()} />;

  async function create(v: Vals) { await api("/api/problems", { method: "POST", json: v }); toast("success", "Problem added"); setAdding(false); await mutate(); }
  async function update(id: string, v: Vals) { await api(`/api/problems/${id}`, { method: "PUT", json: v }); toast("success", "Problem updated"); await mutate(); }
  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    try { await api(`/api/problems/${id}`, { method: "DELETE" }); toast("success", "Problem deleted"); await mutate(); } catch (e) { toast("error", (e as Error).message); }
  }
  async function saveFinal() {
    if (!finalId) { toast("error", "Select which problem is the final one."); return; }
    if (stmt.trim().length < 20) { toast("error", "Write the final problem statement (at least a full sentence)."); return; }
    setSavingFinal(true);
    try { await api("/api/settings", { method: "PUT", json: { final_problem_id: finalId, final_statement: stmt } }); toast("success", "Final problem statement saved"); await mutate(); }
    catch (e) { toast("error", (e as Error).message); } finally { setSavingFinal(false); }
  }

  return (
    <>
      <PageHeader title="Problem discovery workspace" subtitle="Compare candidate problems, adjust the scores with your own judgement, then choose the final statement."
        actions={<Button onClick={() => setAdding(!adding)}><Plus className="h-4 w-4" />Add problem</Button>} />
      <div className="space-y-6">
        {adding && <Card><h2 className="mb-4 font-semibold">New problem</h2><ProblemForm initial={blank} total={total} submitLabel="Add problem" onSubmit={create} /></Card>}

        {!ranked.length ? (
          <EmptyState icon={<Target className="h-6 w-6" />} title="No problems to compare yet" body="Add problems manually, or run AI analysis and add the evidence-backed ones it finds." />
        ) : (
          <>
            <Card className="overflow-x-auto">
              <h2 className="mb-1 font-semibold">Comparison</h2>
              <p className="mb-3 text-xs text-slate-500">Priority = frequency {WEIGHTS.frequency * 100}% + severity {WEIGHTS.severity * 100}% + customer impact {WEIGHTS.impact * 100}% + feasibility {WEIGHTS.feasibility * 100}% (all on a 1–5 scale; frequency = share of {total} eligible interviews).</p>
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Problem</th><th>Frequency</th><th>Severity</th><th>Impact</th><th>Feasibility</th><th>Priority</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {ranked.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-3 font-medium">{p.title} {p.id === data.settings.final_problem_id && <Badge tone="indigo">Final</Badge>}</td>
                      <td>{Math.min(p.frequency_count, total)}/{total}</td><td>{p.severity}</td><td>{p.customer_impact}</td><td>{p.tech_feasibility}</td>
                      <td><div className="flex items-center gap-2"><div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600" style={{ width: `${(p.score / 5) * 100}%` }} /></div><span className="font-semibold">{p.score}</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="space-y-3">
              {ranked.map((p) => (
                <details key={p.id} className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4">
                    <span className="font-medium">{p.title}</span>
                    <span className="flex items-center gap-2"><Badge tone={p.source === "ai" ? "indigo" : "slate"}>{p.source === "ai" ? "AI-suggested" : "Researcher"}</Badge><Badge tone="green">Priority {p.score}</Badge></span>
                  </summary>
                  <div className="space-y-4 border-t border-slate-100 p-4">
                    {p.evidence.length > 0 && <div><span className="text-xs font-medium uppercase text-slate-500">Observed evidence</span><Evidence items={p.evidence} /></div>}
                    <ProblemForm initial={{ title: p.title, description: p.description, root_cause: p.root_cause, recommendation: p.recommendation, frequency_count: p.frequency_count, severity: p.severity, customer_impact: p.customer_impact, tech_feasibility: p.tech_feasibility }}
                      total={total} submitLabel="Save changes" onSubmit={(v) => update(p.id, v)} />
                    <Button variant="danger" onClick={() => remove(p.id, p.title)}>Delete problem</Button>
                  </div>
                </details>
              ))}
            </div>

            <Card className="space-y-4 border-indigo-200">
              <h2 className="font-semibold">Final problem statement</h2>
              <p className="text-sm text-slate-500">You decide. AI drafts are only suggestions.</p>
              <Field label="Selected problem">
                <select className={inputCls()} value={finalId} onChange={(e) => setFinalId(e.target.value)}>
                  <option value="">Choose a problem…</option>{ranked.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </Field>
              <Field label="Problem statement" hint="Who struggles with what, in which situation, and why it matters.">
                <textarea rows={4} className={inputCls()} value={stmt} onChange={(e) => setStmt(e.target.value)} maxLength={2000} />
              </Field>
              <Button loading={savingFinal} onClick={saveFinal}>Save final problem statement</Button>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
