"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, ClipboardList, Layers, MessagesSquare, Plus, Sparkles, Users } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import type { Settings } from "@/lib/types";
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorBox, Loading, PageHeader, inputCls, useToast } from "@/components/ui";

type Dash = {
  settings: Settings;
  totals: { all: number; completed: number; drafts: number; eligible: number };
  categories: { category: string; completed: number; in_progress: number }[];
  recent: { id: string; research_id: string; category: string; status: string; updated_at: string }[];
  emerging: { title: string; interview_count: number; repeated: boolean }[];
  analysis: { created_at: string; eligible_count: number } | null;
};

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3 text-slate-500">
        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">{icon}</div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const { data, error, isLoading, mutate } = useSWR<Dash>("/api/dashboard", fetcher);
  const toast = useToast();
  const [target, setTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={error?.message ?? "Could not load the dashboard."} onRetry={() => mutate()} />;

  const { totals, settings } = data;
  const pct = Math.min(100, Math.round((totals.completed / settings.target_interviews) * 100));
  const categoriesCovered = data.categories.filter((c) => c.completed > 0).length;

  async function saveTarget() {
    setSaving(true);
    try {
      await api("/api/settings", { method: "PUT", json: { target_interviews: Number(target) } });
      toast("success", "Target updated"); setTarget(null); await mutate();
    } catch (e) { toast("error", (e as Error).message); } finally { setSaving(false); }
  }

  return (
    <>
      <PageHeader title="Research dashboard" subtitle={`${settings.brand} customer research. Every number here is computed from your recorded interviews.`}
        actions={<ButtonLink href="/interviews/new"><Plus className="h-4 w-4" />New interview</ButtonLink>} />

      {totals.all === 0 ? (
        <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title="No interviews recorded yet"
          body="Add your first customer interview. The dashboard fills in from real records only; nothing is pre-populated."
          action={<ButtonLink href="/interviews/new"><Plus className="h-4 w-4" />Add first interview</ButtonLink>} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Interviews completed" value={totals.completed} sub={`${totals.drafts} still in draft`} />
            <Stat icon={<Users className="h-4 w-4" />} label="Eligible customers" value={totals.eligible} sub="Completed + consented to share feedback" />
            <Stat icon={<Layers className="h-4 w-4" />} label="Categories covered" value={`${categoriesCovered} / 4`} />
            <Stat icon={<ClipboardList className="h-4 w-4" />} label="Total records" value={totals.all} />
          </div>

          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Research completion</h2>
                <p className="text-sm text-slate-500">{totals.completed} of {settings.target_interviews} target interviews completed</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500" htmlFor="target">Target</label>
                <input id="target" type="number" min={1} max={100} className={inputCls() + " !w-20"}
                  value={target ?? settings.target_interviews} onChange={(e) => setTarget(e.target.value)} />
                {target !== null && Number(target) !== settings.target_interviews && <Button loading={saving} onClick={saveTarget}>Save</Button>}
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{pct}% · Cross-interview AI analysis unlocks at 3 eligible interviews ({totals.eligible} so far).</p>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 font-semibold">Product category distribution</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.categories} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip /><Legend />
                    <Bar dataKey="completed" name="Completed" stackId="a" fill="#4f46e5" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="in_progress" name="In draft" stackId="a" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Emerging customer problems</h2>
                {data.analysis && <Badge tone="indigo">from {data.analysis.eligible_count} interviews</Badge>}
              </div>
              {data.emerging.length ? (
                <ul className="space-y-2">
                  {data.emerging.map((p) => (
                    <li key={p.title} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <span className="font-medium">{p.title}</span>
                      <Badge tone={p.repeated ? "green" : "slate"}>{p.interview_count} interview{p.interview_count === 1 ? "" : "s"}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<Sparkles className="h-5 w-5" />} title="No analysis yet"
                  body="Problems appear here after you run cross-interview analysis on at least 3 eligible interviews."
                  action={<ButtonLink href="/analysis" variant="secondary">Open AI analysis</ButtonLink>} />
              )}
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 font-semibold">Recent interview activity</h2>
            <ul className="divide-y divide-slate-100">
              {data.recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/interviews/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:bg-slate-50">
                    <span className="font-medium">{r.research_id} <span className="font-normal text-slate-500">· {r.category}</span></span>
                    <span className="flex items-center gap-3">
                      <Badge tone={r.status === "completed" ? "green" : "amber"}>{r.status === "completed" ? "Completed" : "Draft"}</Badge>
                      <span className="text-xs text-slate-400">{new Date(r.updated_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
