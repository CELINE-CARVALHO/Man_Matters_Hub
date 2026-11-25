"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Eye, EyeOff, Lock, Sparkles } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { NOTE_FIELDS } from "@/lib/constants";
import type { StoredAnalysis, SummaryContent } from "@/lib/types";
import { Badge, Button, ButtonLink, Card, ErrorBox, Hypothesis, Loading, Observed, PageHeader, useToast } from "@/components/ui";

export default function InterviewDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<{ interview: any; summary: StoredAnalysis<SummaryContent> | null }>(`/api/interviews/${id}`, fetcher);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={error?.message ?? "Interview not found."} onRetry={() => mutate()} />;
  const { interview: r, summary } = data;
  const stale = !!summary && new Date(summary.created_at) < new Date(r.updated_at);

  async function run<T>(name: string, fn: () => Promise<T>, ok: string) {
    setBusy(name);
    try { await fn(); toast("success", ok); await mutate(); } catch (e) { toast("error", (e as Error).message); } finally { setBusy(null); }
  }
  const toggleStatus = () => run("status", () => api(`/api/interviews/${id}`, { method: "PATCH", json: { status: r.status === "completed" ? "draft" : "completed" } }), "Status updated");
  const summarise = () => run("ai", () => api(`/api/ai/summarize`, { method: "POST", json: { interviewId: id } }), "Summary generated");
  async function remove() {
    if (!confirm(`Delete interview ${r.research_id}? This cannot be undone.`)) return;
    setBusy("del");
    try { await api(`/api/interviews/${id}`, { method: "DELETE" }); toast("success", "Interview deleted"); router.push("/interviews"); }
    catch (e) { toast("error", (e as Error).message); setBusy(null); }
  }

  const s = summary?.content;
  return (
    <>
      <PageHeader title={r.research_id} subtitle={`${r.category} · ${r.interview_date}`}
        actions={<>
          <Button variant="secondary" loading={busy === "status"} onClick={toggleStatus}>{r.status === "completed" ? "Reopen as draft" : "Mark completed"}</Button>
          <ButtonLink href={`/interviews/${id}/edit`} variant="secondary">Edit</ButtonLink>
          <Button variant="danger" loading={busy === "del"} onClick={remove}>Delete</Button>
        </>} />
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap gap-2">
            <Badge tone={r.status === "completed" ? "green" : "amber"}>{r.status === "completed" ? "Completed" : "Draft"}</Badge>
            <Badge tone={r.consent_feedback ? "green" : "red"}>{r.consent_feedback ? "Consented to participate & share feedback" : "No consent to share feedback"}</Badge>
            <Badge tone={r.consent_identity ? "green" : "slate"}>{r.consent_identity ? "Identity may be shared with Mosaic" : "Identity stays anonymous"}</Badge>
          </div>
          <p className="mt-3 text-sm text-slate-500"><strong>Products:</strong> {r.products_used.join(", ") || "None listed"}</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4 text-slate-500" />Private details</h2>
            <Button variant="ghost" onClick={() => setReveal(!reveal)}>{reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{reveal ? "Hide" : "Reveal"}</Button>
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{reveal ? r.participant_name || "-" : "••••••••"}</dd></div>
            <div><dt className="text-slate-500">Phone</dt><dd className="font-medium">{reveal ? r.phone || "-" : "••••••••"}</dd></div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Interview notes</h2>
          <dl className="space-y-4">
            {NOTE_FIELDS.map(([k, label]) => (
              <div key={k}><dt className="text-sm font-medium text-slate-700">{label}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">{r[k] || <span className="text-slate-400">Not recorded</span>}</dd></div>
            ))}
          </dl>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-indigo-600" />AI summary</h2>
            <Button variant="secondary" loading={busy === "ai"} disabled={r.status !== "completed"} onClick={summarise}>{s ? "Regenerate" : "Generate summary"}</Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Name, phone and anything resembling them are removed before notes reach the AI.</p>
          {r.status !== "completed" && <p className="mt-3 text-sm text-slate-500">Mark the interview as completed to enable summarisation.</p>}
          {stale && <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-800">Notes changed after this summary was generated. Regenerate it.</p>}
          {s && (
            <div className="mt-4 space-y-4 text-sm">
              <div><div className="mb-1 flex items-center gap-2"><Observed /><Badge tone="slate">Overall: {s.sentiment}</Badge></div><p className="text-slate-700">{s.summary}</p></div>
              {([["Positive", s.positive_points], ["Negative", s.negative_points]] as const).map(([t, list]) => list.length > 0 && (
                <div key={t}><h3 className="font-medium">{t} points</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">{list.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              ))}
              {s.key_quotes.length > 0 && (
                <div><h3 className="font-medium">Verbatim excerpts <span className="text-xs font-normal text-slate-500">(machine-checked against your notes)</span></h3>
                  <ul className="mt-1 space-y-1.5">{s.key_quotes.map((q, i) => <li key={i} className="rounded-lg border-l-2 border-emerald-400 bg-emerald-50/60 px-3 py-1.5">“{q}”</li>)}</ul></div>
              )}
              {s.hypotheses.length > 0 && (
                <div className="rounded-xl bg-amber-50/60 p-3"><div className="mb-1"><Hypothesis /></div>
                  <ul className="space-y-1.5 text-slate-700">{s.hypotheses.map((h, i) => <li key={i}>{h.hypothesis} <span className="text-slate-500">(basis: {h.basis})</span></li>)}</ul></div>
              )}
              {s.gaps.length > 0 && (<div><h3 className="font-medium">Worth asking next</h3><ul className="mt-1 list-disc pl-5 text-slate-600">{s.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul></div>)}
              <p className="text-xs text-slate-400">Generated {new Date(summary!.created_at).toLocaleString()} · {summary!.model}{s.meta.dropped_quotes > 0 && ` · ${s.meta.dropped_quotes} unverifiable quote(s) discarded`}</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
