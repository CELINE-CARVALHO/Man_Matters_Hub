import { NextResponse } from "next/server";
import { CrossSchema, crossPrompt, processCross, SYSTEM } from "@/lib/ai";
import { MIN_INTERVIEWS } from "@/lib/constants";
import { dbError, loadEligible, loadPeople } from "@/lib/data";
import { groqJSON } from "@/lib/groq";
import { AppError, requireUser, route } from "@/lib/http";
import { sanitise } from "@/lib/privacy";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const COLS = "id, created_at, model, evidence_count, content";

export const GET = route(async () => {
  const { supabase } = await requireUser();
  const eligible = await loadEligible(supabase);
  const { data, error } = await supabase.from("analyses").select(COLS).eq("kind", "cross").order("created_at", { ascending: false }).limit(1);
  if (error) throw dbError(error);
  const latest = data?.[0] ?? null;
  const stale = !!latest && (latest.evidence_count !== eligible.length ||
    eligible.some((r) => new Date(r.updated_at) > new Date(latest.created_at)));
  return NextResponse.json({ eligible_count: eligible.length, min_required: MIN_INTERVIEWS, latest, stale });
});

export const POST = route(async () => {
  const { supabase } = await requireUser();
  const rows = await loadEligible(supabase);
  if (rows.length < MIN_INTERVIEWS)
    throw new AppError(422, `Cross-interview analysis needs at least ${MIN_INTERVIEWS} completed interviews with feedback consent. You have ${rows.length}.`);

  const items = sanitise(rows, await loadPeople(supabase, rows.map((r) => r.id)));
  if (items.reduce((n, i) => n + i.text.length, 0) > 80_000)
    throw new AppError(413, "There is too much interview text for a single analysis. Shorten some notes and retry.");

  const { data: raw, model } = await groqJSON<Parameters<typeof processCross>[0]>(
    SYSTEM,
    crossPrompt(items),
    CrossSchema
  );
  const content = processCross(raw, items);
  const ins = await supabase.from("analyses")
    .insert({ kind: "cross", evidence_count: rows.length, model, content }).select(COLS).single();
  if (ins.error) throw dbError(ins.error);
  return NextResponse.json({ eligible_count: rows.length, min_required: MIN_INTERVIEWS, latest: ins.data, stale: false });
});
