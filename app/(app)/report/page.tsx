"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, Download, Printer } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import type { Block } from "@/lib/report";
import { Button, Card, ErrorBox, Loading, PageHeader, inputCls, useToast } from "@/components/ui";

type Resp = { blocks: Block[]; warnings: string[]; brand: string; readiness: { eligible: number; min_required: number; has_analysis: boolean; has_final: boolean } };

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3 text-sm text-slate-700">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h1": return <h1 key={i} className="text-2xl font-semibold text-slate-900">{b.text}</h1>;
          case "h2": return <h2 key={i} className="mt-6 border-b border-slate-200 pb-1 text-lg font-semibold text-slate-900">{b.text}</h2>;
          case "h3": return <h3 key={i} className="mt-4 font-semibold text-slate-900">{b.text}</h3>;
          case "quote": return <blockquote key={i} className="border-l-2 border-indigo-400 bg-slate-50 px-3 py-1.5">{b.text}</blockquote>;
          case "ul": return <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>;
          default: return <p key={i}>{b.text}</p>;
        }
      })}
    </div>
  );
}

export default function ReportPage() {
  const toast = useToast();
  const [names, setNames] = useState(true);
  const [brand, setBrand] = useState("");
  const [saving, setSaving] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<Resp>(`/api/report?format=json&names=${names ? 1 : 0}`, fetcher);
  useEffect(() => { if (data) setBrand(data.brand); }, [data?.brand]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox message={error?.message ?? "Could not build the report."} onRetry={() => mutate()} />;

  async function saveBrand() {
    setSaving(true);
    try { await api("/api/settings", { method: "PUT", json: { brand } }); toast("success", "Brand updated"); await mutate(); }
    catch (e) { toast("error", (e as Error).message); } finally { setSaving(false); }
  }
  const q = `names=${names ? 1 : 0}`;

  return (
    <>
      <PageHeader title="Research report" subtitle="Built from your recorded interviews, AI analysis and problem workspace. Phone numbers are never included."
        actions={<>
          <a className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700" href={`/api/report?format=md&${q}`} download><Download className="h-4 w-4" />Download Markdown</a>
          <a className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" href={`/api/report?format=html&${q}`} target="_blank" rel="noreferrer"><Printer className="h-4 w-4" />Printable / PDF</a>
        </>} />
      <div className="space-y-6">
        <Card className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Brand selected
              <div className="mt-1 flex gap-2"><input className={inputCls()} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} />
                {brand.trim() && brand !== data.brand && <Button loading={saving} onClick={saveBrand}>Save</Button>}</div></label>
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={names} onChange={(e) => setNames(e.target.checked)} />
              <span>Include names of participants who gave explicit permission to share their identity. Everyone else stays anonymous.</span></label>
          </div>
        </Card>

        {data.warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="mb-1 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />Before you submit</div>
            <ul className="list-disc pl-5">{data.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
        <Card className="!p-6 sm:!p-8"><Blocks blocks={data.blocks} /></Card>
      </div>
    </>
  );
}
