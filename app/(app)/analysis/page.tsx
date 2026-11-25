"use client";
import { useState } from "react";
import useSWR from "swr";
import { Lock, Sparkles } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { JOURNEY_STAGES } from "@/lib/constants";
import { priorityScore } from "@/lib/scoring";
import type { CrossContent, Problem, StoredAnalysis } from "@/lib/types";
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorBox, Evidence, Hypothesis, Loading, Observed, PageHeader, useToast } from "@/components/ui";

type Resp = { eligible_count: number; min_required: number; latest: StoredAnalysis<CrossContent> | null; stale: boolean };

const Count = ({ n, total }: { n: number; total: number }) => <Badge tone={n >= 2 ? "green" : "slate"}>{n} of {total} interviews</Badge>;

export default function AnalysisPage() {
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<Resp>("/api/ai/cross-analysis", fetcher);
  const { data: probs, mutate: mutateProbs } = useSWR<{ items: Problem[] }>("/api/problems", fetcher);
  const [running, setRunning] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={error?.message ?? "Could not load analysis."} onRetry={() => mutate()} />;

  const { eligible_count: n, min_required: min } = data;
  const c = data.latest?.content;
  const locked = n < min;

  async function run() {
    setRunning(true);
    try { const r = await api<Resp>("/api/ai/cross-analysis", { method: "POST" }); await mutate(r, { revalidate: false }); toast("success", "Analysis complete"); }
    catch (e) { toast("error", (e as Error).message); } finally { setRunning(false); }
  }
  async function addProblem(p: CrossContent["problems"][number]) {
    setAdding(p.id);
    try {
      await api("/api/problems", { method: "POST", json: {
        title: p.title, description: p.description, root_cause: p.root_cause_hypothesis, recommendation: p.recommendation,
        frequency_count: p.interview_count, severity: p.severity, customer_impact: p.customer_impact,
        tech_feasibility: p.tech_feasibility, source: "ai", evidence: p.evidence.slice(0, 20),
      } });
      toast("success", "Added to the problem workspace"); await mutateProbs();
    } catch (e) { toast("error", (e as Error).message); } finally { setAdding(null); }
  }
  
  async function saveStatement(statement: string) {
    try { await api("/api/settings", { method: "PUT", json: { final_statement: statement } }); toast("success", "Saved as your draft final statement. Pick the problem in the workspace."); }
    catch (e) { toast("error", (e as Error).message); }
  }

  const stages = c ? [...c.journey_friction].sort((a, b) => {
    const ia = JOURNEY_STAGES.findIndex((s) => a.stage.toLowerCase().startsWith(s.toLowerCase())), ib = JOURNEY_STAGES.findIndex((s) => b.stage.toLowerCase().startsWith(s.toLowerCase()));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  }) : [];

  return (
    <>
      <PageHeader title="AI research analyst" subtitle="Groq analyses anonymised interview notes. Observed evidence and hypotheses are always labelled separately."
        actions={<Button loading={running} disabled={locked} onClick={run}><Sparkles className="h-4 w-4" />{c ? "Re-run analysis" : "Run cross-interview analysis"}</Button>} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><div className="text-sm text-slate-500">Evidence base</div>
            <div className="text-2xl font-semibold">{n} <span className="text-base font-normal text-slate-500">completed interview{n === 1 ? "" : "s"} with feedback consent</span></div></div>
          <Badge tone={locked ? "amber" : "green"}>{locked ? `${min - n} more needed` : `Minimum of ${min} met`}</Badge>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, (n / min) * 100)}%` }} /></div>
      </Card>

      {running && <p className="mb-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700">Analysing… this can take up to a minute.</p>}

      {locked ? (
        <EmptyState icon={<Lock className="h-6 w-6" />} title={`Cross-interview analysis unlocks at ${min} interviews`}
          body={`You have ${n}. Complete more genuine interviews (with feedback consent) so patterns rest on real evidence rather than a single conversation.`}
          action={<ButtonLink href="/interviews/new">Add interview</ButtonLink>} />
      ) : !c ? (
        <EmptyState icon={<Sparkles className="h-6 w-6" />} title="No analysis yet" body="Run the analysis to find themes, sentiment, repeated problems and journey friction across your interviews." />
      ) : (
        <div className="space-y-6">
          {data.stale && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your interviews changed since this analysis ran. Re-run it so it reflects the current evidence.</p>}
          <p className="text-xs text-slate-500">Generated {new Date(data.latest!.created_at).toLocaleString()} · {data.latest!.model} · from {c.meta.eligible_count} interviews ({c.meta.research_ids.join(", ")}) · {c.meta.dropped_quotes} unverifiable quote(s) and {c.meta.dropped_items} unsupported item(s) were discarded. Counts come from verified quotations only.</p>

          <Card>
            <div className="mb-3 flex items-center gap-2"><h2 className="font-semibold">Themes</h2><Observed /></div>
            {c.themes.length ? <ul className="space-y-4">{c.themes.map((t, i) => (
              <li key={i}><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.title}</span><Count n={t.interview_count} total={n} /></div>
                <p className="mt-0.5 text-sm text-slate-600">{t.description}</p><Evidence items={t.evidence} /></li>
            ))}</ul> : <p className="text-sm text-slate-500">No evidence-backed themes were identified.</p>}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {([["Positive sentiment", c.sentiment.positive], ["Negative sentiment", c.sentiment.negative]] as const).map(([title, list]) => (
              <Card key={title}>
                <div className="mb-3 flex items-center gap-2"><h2 className="font-semibold">{title}</h2><Observed /></div>
                {list.length ? <ul className="space-y-3">{list.map((p, i) => (
                  <li key={i}><div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{p.point}</span><Count n={p.interview_count} total={n} /></div><Evidence items={p.evidence.slice(0, 2)} /></li>
                ))}</ul> : <p className="text-sm text-slate-500">Nothing evidence-backed found.</p>}
              </Card>
            ))}
          </div>

          <Card>
            <div className="mb-3 flex items-center gap-2"><h2 className="font-semibold">Repeated and emerging problems</h2></div>
            {c.problems.length ? <ul className="space-y-5">{c.problems.map((p) => {
              const exists = probs?.items.some((x) => x.title.toLowerCase() === p.title.toLowerCase());
              return (
                <li key={p.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{p.title}</span><Count n={p.interview_count} total={n} />
                      <Badge tone={p.repeated ? "green" : "slate"}>{p.repeated ? "Repeated" : "Single mention"}</Badge></div>
                    <Button variant="secondary" loading={adding === p.id} disabled={exists} onClick={() => addProblem(p)}>{exists ? "In workspace" : "Add to workspace"}</Button>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{p.description}</p>
                  <div className="mt-2"><Observed /></div><Evidence items={p.evidence} />
                  <div className="mt-3 space-y-1 rounded-lg bg-amber-50/60 p-3 text-sm text-slate-700">
                    <Hypothesis />
                    {p.root_cause_hypothesis && <p><strong>Possible root cause:</strong> {p.root_cause_hypothesis}</p>}
                    {p.recommendation && <p><strong>Possible improvement:</strong> {p.recommendation}</p>}
                    <p className="text-xs text-slate-500">AI estimates: severity {p.severity}/5 · customer impact {p.customer_impact}/5 · tech feasibility {p.tech_feasibility}/5 · priority {priorityScore({ frequency_count: p.interview_count, severity: p.severity, customer_impact: p.customer_impact, tech_feasibility: p.tech_feasibility }, n)}/5. {p.rationale}</p>
                  </div>
                </li>
              );
            })}</ul> : <p className="text-sm text-slate-500">No evidence-backed problems were identified.</p>}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Customer journey friction</h2>
            {stages.length ? <ul className="space-y-3">{stages.map((f, i) => (
              <li key={i}><div className="flex flex-wrap items-center gap-2 text-sm"><Badge tone="indigo">{f.stage}</Badge><span className="font-medium">{f.friction}</span><Count n={f.interview_count} total={n} /></div><Evidence items={f.evidence.slice(0, 2)} /></li>
            ))}</ul> : <p className="text-sm text-slate-500">No evidence-backed friction points found.</p>}
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2"><h2 className="font-semibold">Draft problem statements</h2><Hypothesis /></div>
            {c.problem_statements.length ? <ul className="space-y-3">{c.problem_statements.map((s, i) => (
              <li key={i} className="rounded-xl bg-slate-50 p-4 text-sm">
                <p className="text-slate-800">{s.statement}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">Based on {s.problem_ids.join(", ")}</span>
                  <Button variant="secondary" onClick={() => saveStatement(s.statement)}>Use as draft final statement</Button></div>
              </li>
            ))}</ul> : <p className="text-sm text-slate-500">No statements generated. Write your own in the problem workspace.</p>}
          </Card>
        </div>
      )}
    </>
  );
}
