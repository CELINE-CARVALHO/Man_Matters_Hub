import { z } from "zod";
import { quoteInCorpus, type Sanitised } from "./privacy";
import type { CrossContent, Ev, SummaryContent } from "./types";

export const SYSTEM = `You are a careful qualitative research analyst helping a student researcher.
You receive anonymised customer-interview notes written by the researcher.
Rules:
1. Use ONLY the notes provided. Never invent customers, statements, numbers, counts or findings.
2. Every observed finding needs evidence items: "ref" (the interview label, e.g. INT-2) and "quote" copied VERBATIM, character for character, from that interview's notes (under ~200 characters).
3. Never state how many interviews mention something. The system counts that from your evidence.
4. Root causes, recommendations and scores are HYPOTHESES or estimates. Put them only in the fields meant for them and phrase them tentatively.
5. If the notes are too thin for a section, return an empty array for it.
6. Respond with ONE JSON object matching the requested shape. No markdown, no commentary.`;

const str = z.string().default("");
const score = z.coerce.number().int().min(1).max(5).catch(3);
const ev = z.array(z.object({ ref: z.string(), quote: z.string() })).default([]);

export const SummarySchema = z.object({
  summary: str,
  sentiment: z.enum(["positive", "negative", "mixed", "neutral"]).catch("neutral"),
  positive_points: z.array(z.string()).default([]),
  negative_points: z.array(z.string()).default([]),
  key_quotes: z.array(z.string()).default([]),
  hypotheses: z.array(z.object({ hypothesis: str, basis: str })).default([]),
  gaps: z.array(z.string()).default([]),
});

export const CrossSchema = z.object({
  themes: z.array(z.object({ title: str, description: str, evidence: ev })).default([]),
  sentiment: z.object({
    positive: z.array(z.object({ point: str, evidence: ev })).default([]),
    negative: z.array(z.object({ point: str, evidence: ev })).default([]),
  }).default({}),
  problems: z.array(z.object({
    id: str, title: str, description: str, evidence: ev, root_cause_hypothesis: str,
    severity: score, customer_impact: score, tech_feasibility: score, rationale: str, recommendation: str,
  })).default([]),
  journey_friction: z.array(z.object({ stage: str, friction: str, evidence: ev })).default([]),
  problem_statements: z.array(z.object({ statement: str, problem_ids: z.array(z.string()).default([]) })).default([]),
});

export const summaryPrompt = (i: Sanitised) => `Interview notes (anonymised):

${i.text}

Return JSON:
{
  "summary": "3-5 sentences describing only what the notes say",
  "sentiment": "positive|negative|mixed|neutral",
  "positive_points": ["..."],
  "negative_points": ["..."],
  "key_quotes": ["verbatim excerpt from the notes", "..."],
  "hypotheses": [{"hypothesis": "tentative explanation", "basis": "which note content it rests on"}],
  "gaps": ["things the notes do not cover that would be worth asking next"]
}
Max 5 key_quotes, each copied verbatim.`;

export const crossPrompt = (items: Sanitised[]) => `There are ${items.length} anonymised interviews.

${items.map((i) => i.text).join("\n\n")}

Return JSON of exactly this shape (each "evidence" item is {"ref": "INT-1", "quote": "verbatim text from INT-1"}):
{
  "themes": [{"title": "", "description": "", "evidence": []}],
  "sentiment": {"positive": [{"point": "", "evidence": []}], "negative": [{"point": "", "evidence": []}]},
  "problems": [{"id": "P1", "title": "", "description": "", "evidence": [], "root_cause_hypothesis": "", "severity": 1, "customer_impact": 1, "tech_feasibility": 1, "rationale": "", "recommendation": ""}],
  "journey_friction": [{"stage": "Discovery|Purchase|First use|Ongoing use|Results & repurchase", "friction": "", "evidence": []}],
  "problem_statements": [{"statement": "", "problem_ids": ["P1"]}]
}
Guidance:
- Include evidence from EVERY interview that supports an item. Problems seen in several interviews matter most, but a serious single-mention problem may be included.
- severity and customer_impact: your estimate (1-5, 5 = worst). tech_feasibility: how feasible a technology-based fix would be (1-5, 5 = easiest). These are estimates, explain briefly in "rationale".
- problem_statements: at most 3, each shaped "Customers who ... struggle with ... because (hypothesised cause), leading to ...", grounded only in the listed problems.`;

type Stats = { dropped: number; items: number };

function cleanEvidence(list: { ref: string; quote: string }[], by: Map<string, Sanitised>, stats: Stats): Ev[] {
  const out: Ev[] = [];
  const seen = new Set<string>();
  for (const e of list) {
    const src = by.get(e.ref.trim().toUpperCase());
    if (!src || !quoteInCorpus(e.quote, src.corpus)) { stats.dropped++; continue; } // unverifiable → discarded
    const k = `${src.research_id}|${e.quote.trim()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ref: src.research_id, quote: e.quote.trim() });
  }
  return out;
}
const countOf = (e: Ev[]) => new Set(e.map((x) => x.ref)).size;

export function processCross(raw: z.infer<typeof CrossSchema>, items: Sanitised[]): CrossContent {
  const by = new Map(items.map((s) => [s.alias, s]));
  const stats: Stats = { dropped: 0, items: 0 };
  const keep = (e: Ev[], label: string) => { if (!label.trim() || e.length === 0) { stats.items++; return false; } return true; };

  const themes = raw.themes.flatMap((t) => {
    const evidence = cleanEvidence(t.evidence, by, stats);
    return keep(evidence, t.title) ? [{ title: t.title.trim(), description: t.description.trim(), evidence, interview_count: countOf(evidence) }] : [];
  });
  const side = (list: { point: string; evidence: { ref: string; quote: string }[] }[]) =>
    list.flatMap((p) => {
      const evidence = cleanEvidence(p.evidence, by, stats);
      return keep(evidence, p.point) ? [{ point: p.point.trim(), evidence, interview_count: countOf(evidence) }] : [];
    });

  const idMap = new Map<string, string>();
  const problems = raw.problems.flatMap((p) => {
    const evidence = cleanEvidence(p.evidence, by, stats);
    if (!keep(evidence, p.title)) return [];
    const count = countOf(evidence);
    return [{
      id: "", title: p.title.trim(), description: p.description.trim(), evidence, interview_count: count,
      repeated: count >= 2, root_cause_hypothesis: p.root_cause_hypothesis.trim(),
      severity: p.severity, customer_impact: p.customer_impact, tech_feasibility: p.tech_feasibility,
      rationale: p.rationale.trim(), recommendation: p.recommendation.trim(), _orig: p.id.trim(),
    }];
  }).sort((a, b) => b.interview_count - a.interview_count)
    .map(({ _orig, ...p }, i) => { const id = `P${i + 1}`; if (_orig) idMap.set(_orig, id); return { ...p, id }; });

  const problem_statements = raw.problem_statements.flatMap((s) => {
    const ids = s.problem_ids.map((x) => idMap.get(x.trim())).filter((x): x is string => !!x);
    return s.statement.trim() && ids.length ? [{ statement: s.statement.trim(), problem_ids: ids }] : [];
  });

  return {
    themes: themes.sort((a, b) => b.interview_count - a.interview_count),
    sentiment: { positive: side(raw.sentiment.positive), negative: side(raw.sentiment.negative) },
    problems,
    journey_friction: raw.journey_friction.flatMap((f) => {
      const evidence = cleanEvidence(f.evidence, by, stats);
      return keep(evidence, f.friction) ? [{ stage: f.stage.trim() || "Other", friction: f.friction.trim(), evidence, interview_count: countOf(evidence) }] : [];
    }),
    problem_statements,
    meta: { eligible_count: items.length, research_ids: items.map((i) => i.research_id), dropped_quotes: stats.dropped, dropped_items: stats.items },
  };
}

export function processSummary(raw: z.infer<typeof SummarySchema>, item: Sanitised): SummaryContent {
  const quotes = raw.key_quotes.filter((q) => quoteInCorpus(q, item.corpus));
  return {
    summary: raw.summary.trim(), sentiment: raw.sentiment,
    positive_points: raw.positive_points, negative_points: raw.negative_points,
    key_quotes: quotes, hypotheses: raw.hypotheses, gaps: raw.gaps,
    meta: { dropped_quotes: raw.key_quotes.length - quotes.length },
  };
}
