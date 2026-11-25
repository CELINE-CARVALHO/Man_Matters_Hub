import { NextResponse } from "next/server";
import { processSummary, SummarySchema, summaryPrompt, SYSTEM } from "@/lib/ai";
import { NOTE_FIELDS } from "@/lib/constants";
import { dbError, loadPeople } from "@/lib/data";
import { groqJSON } from "@/lib/groq";
import { AppError, parse, requireUser, route } from "@/lib/http";
import { sanitise } from "@/lib/privacy";
import type { InterviewRow } from "@/lib/types";
import { summarizeSchema } from "@/lib/validation";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const { supabase } = await requireUser();
  const { interviewId } = await parse(req, summarizeSchema);
  const { data, error } = await supabase.from("interviews").select("*").eq("id", interviewId).maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new AppError(404, "Interview not found");
  const row = data as InterviewRow;
  if (row.status !== "completed") throw new AppError(422, "Mark the interview as completed before summarising it.");
  if (!NOTE_FIELDS.some(([k]) => row[k])) throw new AppError(422, "This interview has no notes to summarise.");

  const people = await loadPeople(supabase, [row.id]);
  const [item] = sanitise([row], people); // identity is redacted here; only `item.text` goes to Groq
  const { data: raw, model } = await groqJSON(SYSTEM, summaryPrompt(item), SummarySchema);
  const content = processSummary(raw, item);

  const ins = await supabase.from("analyses")
    .insert({ kind: "summary", interview_id: row.id, evidence_count: 1, model, content })
    .select("id, created_at, model, evidence_count, content").single();
  if (ins.error) throw dbError(ins.error);
  return NextResponse.json({ summary: ins.data });
});
