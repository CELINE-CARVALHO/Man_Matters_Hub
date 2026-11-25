"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { Check, MessagesSquare, Plus, Search } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";
import type { InterviewRow } from "@/lib/types";
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorBox, Loading, PageHeader, inputCls, useToast } from "@/components/ui";

export default function InterviewsPage() {
  const toast = useToast();
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  const [category, setCategory] = useState(""); const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);

  const key = `/api/interviews?${new URLSearchParams({ q: dq, category, status })}`;
  const { data, error, isLoading, mutate } = useSWR<{ items: InterviewRow[] }>(key, fetcher);
  const filtered = !!(dq || category || status);

  async function complete(id: string, status: "draft" | "completed") {
    setBusy(id);
    try {
      await api(`/api/interviews/${id}`, { method: "PATCH", json: { status } });
      toast("success", status === "completed" ? "Marked as completed" : "Reopened as draft"); await mutate();
    } catch (e) { toast("error", (e as Error).message); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader title="Interviews" subtitle="Search, filter and manage customer interviews."
        actions={<ButtonLink href="/interviews/new"><Plus className="h-4 w-4" />New interview</ButtonLink>} />
      <Card className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, product or notes…" className={inputCls() + " pl-9"} aria-label="Search interviews" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls()} aria-label="Filter by category">
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls()} aria-label="Filter by status">
          <option value="">All statuses</option><option value="draft">Draft</option><option value="completed">Completed</option>
        </select>
      </Card>

      {isLoading ? <Loading /> : error ? <ErrorBox message={error.message} onRetry={() => mutate()} /> :
        !data?.items.length ? (
          <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title={filtered ? "No interviews match your filters" : "No interviews yet"}
            body={filtered ? "Try a different search or clear the filters." : "Record your first customer conversation to get started."}
            action={!filtered && <ButtonLink href="/interviews/new">Add interview</ButtonLink>} />
        ) : (
          <ul className="space-y-3">
            {data.items.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 !p-4">
                  <Link href={`/interviews/${r.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.research_id}</span>
                      <Badge tone="indigo">{r.category}</Badge>
                      <Badge tone={r.status === "completed" ? "green" : "amber"}>{r.status === "completed" ? "Completed" : "Draft"}</Badge>
                      {r.consent_feedback ? <Badge tone="green">Feedback consent</Badge> : <Badge tone="red">No feedback consent</Badge>}
                      {r.consent_identity && <Badge tone="slate">Identity shareable</Badge>}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">{r.products_used.join(", ") || "No products listed"} · {r.interview_date}</p>
                  </Link>
                  <div className="flex gap-2">
                    {r.status === "draft"
                      ? <Button variant="secondary" loading={busy === r.id} onClick={() => complete(r.id, "completed")}><Check className="h-4 w-4" />Complete</Button>
                      : <Button variant="ghost" loading={busy === r.id} onClick={() => complete(r.id, "draft")}>Reopen</Button>}
                    <ButtonLink href={`/interviews/${r.id}/edit`} variant="secondary">Edit</ButtonLink>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}
