import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/constants";
import { dbError, loadSettings } from "@/lib/data";
import { requireUser, route } from "@/lib/http";
import type { CrossContent } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { supabase } = await requireUser();
  const [iv, settings, an] = await Promise.all([
    supabase.from("interviews").select("id, research_id, category, status, consent_feedback, updated_at").order("updated_at", { ascending: false }),
    loadSettings(supabase),
    supabase.from("analyses").select("created_at, evidence_count, content").eq("kind", "cross").order("created_at", { ascending: false }).limit(1),
  ]);
  if (iv.error) throw dbError(iv.error);
  if (an.error) throw dbError(an.error);

  const rows = iv.data ?? [];
  const completed = rows.filter((r) => r.status === "completed");
  const eligible = completed.filter((r) => r.consent_feedback);
  const latest = an.data?.[0];
  const content = latest?.content as CrossContent | undefined;

  return NextResponse.json({
    settings,
    totals: { all: rows.length, completed: completed.length, drafts: rows.length - completed.length, eligible: eligible.length },
    categories: CATEGORIES.map((category) => ({
      category,
      completed: completed.filter((r) => r.category === category).length,
      in_progress: rows.filter((r) => r.category === category && r.status === "draft").length,
    })),
    recent: rows.slice(0, 6).map(({ id, research_id, category, status, updated_at }) => ({ id, research_id, category, status, updated_at })),
    emerging: (content?.problems ?? []).slice(0, 5).map((p) => ({ title: p.title, interview_count: p.interview_count, repeated: p.repeated })),
    analysis: latest ? { created_at: latest.created_at, eligible_count: latest.evidence_count } : null,
  });
});
