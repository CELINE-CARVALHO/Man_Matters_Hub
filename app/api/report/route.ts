import { NextResponse } from "next/server";
import { MIN_INTERVIEWS } from "@/lib/constants";
import { dbError, loadEligible, loadPeople, loadSettings } from "@/lib/data";
import { requireUser, route } from "@/lib/http";
import { buildReport, toHtml, toMarkdown, type ReportInterview } from "@/lib/report";
import type { CrossContent, InterviewRow, Problem, SummaryContent } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const { supabase } = await requireUser();
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") ?? "json";
  const includeNames = sp.get("names") === "1"; // still limited to participants who consented

  const [settings, eligible, completed, probs, cross] = await Promise.all([
    loadSettings(supabase),
    loadEligible(supabase),
    supabase.from("interviews").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("problems").select("*"),
    supabase.from("analyses").select("created_at, evidence_count, model, content").eq("kind", "cross").order("created_at", { ascending: false }).limit(1),
  ]);
  if (completed.error) throw dbError(completed.error);
  if (probs.error) throw dbError(probs.error);
  if (cross.error) throw dbError(cross.error);

  const ids = eligible.map((r) => r.id);
  const people = await loadPeople(supabase, ids);
  const sums = new Map<string, { created_at: string; content: SummaryContent }>();
  if (ids.length) {
    const s = await supabase.from("analyses").select("interview_id, created_at, content").eq("kind", "summary").in("interview_id", ids).order("created_at", { ascending: false });
    if (s.error) throw dbError(s.error);
    (s.data ?? []).forEach((x: any) => { if (!sums.has(x.interview_id)) sums.set(x.interview_id, x); });
  }

  const interviews: ReportInterview[] = eligible.map((r: InterviewRow) => {
    const sm = sums.get(r.id);
    const fresh = sm && new Date(sm.created_at) >= new Date(r.updated_at); // never export a summary older than the notes
    return { ...r, name: people.get(r.id)?.name ?? "", phone: people.get(r.id)?.phone ?? "", summary: fresh ? sm.content : null };
  });

  const latest = cross.data?.[0];
  const crossStale = !!latest && (latest.evidence_count !== eligible.length || eligible.some((r) => new Date(r.updated_at) > new Date(latest.created_at)));
  const { blocks, warnings } = buildReport({
    settings, model: latest?.model ?? null, generatedOn: new Date(), includeNames,
    completedTotal: completed.count ?? 0, eligible: interviews,
    cross: latest ? { created_at: latest.created_at, content: latest.content as CrossContent } : null,
    crossStale, problems: (probs.data ?? []) as Problem[],
  });

  const slug = settings.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
  if (format === "md") return new Response(toMarkdown(blocks), { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}-research-report.md"` } });
  if (format === "html") return new Response(toHtml(blocks, `${settings.brand} Research Report`), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  return NextResponse.json({
    blocks, warnings,
    readiness: { eligible: eligible.length, min_required: MIN_INTERVIEWS, has_analysis: !!latest, has_final: !!settings.final_statement },
    brand: settings.brand,
  });
});
