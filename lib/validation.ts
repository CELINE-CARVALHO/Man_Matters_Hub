import { z } from "zod";
import { CATEGORIES } from "./constants";

const note = z.string().trim().max(4000).default("");

const base = z.object({
  research_id: z.string().trim().min(1, "Research ID is required").max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _ only"),
  participant_name: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(30)
    .refine((v) => v === "" || /^[+\d\s()-]{7,20}$/.test(v), "Enter a valid phone number").default(""),
  consent_feedback: z.boolean(),
  consent_identity: z.boolean(),
  products_used: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: "Choose a product category" }) }),
  purchase_motivation: note, liked: note, disliked: note, difficulties: note,
  expectations: note, incidents: note, observations: note,
  interview_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the interview date"),
  status: z.enum(["draft", "completed"]).default("draft"),
});

export const interviewSchema = base.superRefine((v, ctx) => {
  if (v.consent_identity && !v.consent_feedback) {
    ctx.addIssue({ code: "custom", path: ["consent_identity"], message: "Identity can only be shared if the participant also consented to share feedback" });
  }
  if (v.status === "completed") {
    if (v.products_used.length === 0)
      ctx.addIssue({ code: "custom", path: ["products_used"], message: "Add at least one product before completing" });
    if (![v.liked, v.disliked, v.difficulties].some(Boolean))
      ctx.addIssue({ code: "custom", path: ["difficulties"], message: "Record what they liked, disliked or found difficult before completing" });
  }
});

export const statusSchema = z.object({ status: z.enum(["draft", "completed"]) });
export const idSchema = z.string().uuid();
export const summarizeSchema = z.object({ interviewId: z.string().uuid() });

const score = z.coerce.number().int().min(1).max(5);
export const problemSchema = z.object({
  title: z.string().trim().min(3, "Give the problem a short title").max(200),
  description: z.string().trim().max(2000).default(""),
  root_cause: z.string().trim().max(2000).default(""),
  recommendation: z.string().trim().max(2000).default(""),
  frequency_count: z.coerce.number().int().min(0).max(1000),
  severity: score, customer_impact: score, tech_feasibility: score,
  source: z.enum(["manual", "ai"]).default("manual"),
  evidence: z.array(z.object({ ref: z.string().max(40), quote: z.string().max(500) })).max(20).default([]),
});
export const problemUpdateSchema = problemSchema.omit({ source: true, evidence: true });

export const settingsSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  target_interviews: z.coerce.number().int().min(1).max(100),
  final_problem_id: z.string().uuid().nullable(),
  final_statement: z.string().trim().max(2000).nullable(),
}).partial();
