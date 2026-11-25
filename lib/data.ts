import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "./http";
import type { InterviewRow, Settings } from "./types";

export function dbError(e: { code?: string }) {
  console.error("DB error code:", e.code ?? "unknown"); // code only, never row data
  return e.code === "23505" ? new AppError(409, "That research ID is already in use.") : new AppError(500, "Database error. Please try again.");
}

export const DEFAULT_SETTINGS: Settings = { brand: "Man Matters", target_interviews: 5, final_problem_id: null, final_statement: null };

export async function loadSettings(sb: SupabaseClient): Promise<Settings> {
  const { data, error } = await sb.from("research_settings")
    .select("brand, target_interviews, final_problem_id, final_statement").maybeSingle();
  if (error) throw dbError(error);
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
}

/** Eligible = completed AND participant consented to share feedback. */
export async function loadEligible(sb: SupabaseClient): Promise<InterviewRow[]> {
  const { data, error } = await sb.from("interviews").select("*")
    .eq("status", "completed").eq("consent_feedback", true).order("interview_date").order("created_at");
  if (error) throw dbError(error);
  return (data ?? []) as InterviewRow[];
}

export async function loadPeople(sb: SupabaseClient, ids: string[]) {
  const map = new Map<string, { name: string; phone: string }>();
  if (!ids.length) return map;
  const { data, error } = await sb.from("participants").select("interview_id, name, phone").in("interview_id", ids);
  if (error) throw dbError(error);
  (data ?? []).forEach((p: any) => map.set(p.interview_id, { name: p.name, phone: p.phone }));
  return map;
}
