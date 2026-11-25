import type { NoteField } from "./constants";

export type InterviewRow = Record<NoteField, string> & {
  id: string; research_id: string; category: string; products_used: string[];
  interview_date: string; status: "draft" | "completed";
  consent_feedback: boolean; consent_identity: boolean;
  created_at: string; updated_at: string;
};
export type Ev = { ref: string; quote: string };
type Counted = { interview_count: number };
export type CrossContent = {
  themes: (Counted & { title: string; description: string; evidence: Ev[] })[];
  sentiment: {
    positive: (Counted & { point: string; evidence: Ev[] })[];
    negative: (Counted & { point: string; evidence: Ev[] })[];
  };
  problems: (Counted & {
    id: string; title: string; description: string; evidence: Ev[]; repeated: boolean;
    root_cause_hypothesis: string; severity: number; customer_impact: number; tech_feasibility: number;
    rationale: string; recommendation: string;
  })[];
  journey_friction: (Counted & { stage: string; friction: string; evidence: Ev[] })[];
  problem_statements: { statement: string; problem_ids: string[] }[];
  meta: { eligible_count: number; research_ids: string[]; dropped_quotes: number; dropped_items: number };
};
export type SummaryContent = {
  summary: string; sentiment: "positive" | "negative" | "mixed" | "neutral";
  positive_points: string[]; negative_points: string[]; key_quotes: string[];
  hypotheses: { hypothesis: string; basis: string }[]; gaps: string[];
  meta: { dropped_quotes: number };
};
export type StoredAnalysis<T> = { id: string; created_at: string; model: string; evidence_count: number; content: T };
export type Settings = { brand: string; target_interviews: number; final_problem_id: string | null; final_statement: string | null };
export type Problem = {
  id: string; title: string; description: string; root_cause: string; recommendation: string;
  frequency_count: number; severity: number; customer_impact: number; tech_feasibility: number;
  source: "manual" | "ai"; evidence: Ev[]; created_at: string;
};
