import { CATEGORIES, MIN_INTERVIEWS, NOTE_FIELDS } from "./constants";
import { redact } from "./privacy";
import { priorityScore } from "./scoring";
import type { CrossContent, InterviewRow, Problem, Settings, SummaryContent } from "./types";

export type Block = { t: "h1" | "h2" | "h3" | "p" | "quote"; text: string } | { t: "ul"; items: string[] };
export type ReportInterview = InterviewRow & { name: string; phone: string; summary: SummaryContent | null };
export type ReportInput = {
  settings: Settings; model: string | null; generatedOn: Date; includeNames: boolean; completedTotal: number;
  eligible: ReportInterview[]; cross: { created_at: string; content: CrossContent } | null; crossStale: boolean; problems: Problem[];
};

const date = (s: string) =>
  new Date(s.length === 10 ? `${s}T00:00:00Z` : s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function buildReport(i: ReportInput): { blocks: Block[]; warnings: string[] } {
  const b: Block[] = [];
  const warnings: string[] = [];
  const E = i.eligible, N = E.length, { settings, cross } = i;

  if (N < MIN_INTERVIEWS) warnings.push(`Only ${N} eligible interview(s). At least ${MIN_INTERVIEWS} are needed for cross-interview analysis.`);
  if (!cross) warnings.push("Cross-interview analysis has not been run, so key patterns are missing.");
  else if (i.crossStale) warnings.push("Interviews changed since the last cross-interview analysis. Re-run it before submitting.");
  if (!settings.final_statement) warnings.push("No final problem statement has been selected.");

  b.push({ t: "h1", text: `${settings.brand}: Customer Research Report` });
  b.push({ t: "p", text: `Generated ${date(i.generatedOn.toISOString())}` });

  b.push({ t: "h2", text: "1. Brand selected" }, { t: "p", text: settings.brand });

  const dates = E.map((r) => r.interview_date).sort();
  const range = N ? (dates[0] === dates[N - 1] ? date(dates[0]) : `${date(dates[0])} to ${date(dates[N - 1])}`) : "n/a";
  b.push({ t: "h2", text: "2. Research methodology" }, {
    t: "ul",
    items: [
      `Customer interviews recorded by the researcher. ${N} completed interview(s) with feedback consent are included (interview dates: ${range}).`,
      ...(i.completedTotal > N ? [`${i.completedTotal - N} completed interview(s) were excluded because the participant did not consent to share feedback.`] : []),
      "Participants are identified by research ID. Phone numbers are never included; names appear only where the participant gave explicit permission.",
      `Where AI analysis was used (Groq${i.model ? `, ${i.model}` : ""}), it saw anonymised notes only. Quotations are machine-checked to appear verbatim in the researcher's notes, and interview counts are computed from those verified quotations.`,
      `Root causes, scores and recommendations are hypotheses or estimates, not findings. Cross-interview analysis requires at least ${MIN_INTERVIEWS} interviews.`,
    ],
  });

  const present = CATEGORIES.map((c) => [c, E.filter((r) => r.category === c).length] as const);
  const missing = present.filter(([, n]) => n === 0).map(([c]) => c);
  b.push({ t: "h2", text: "3. Product categories represented" }, {
    t: "ul",
    items: [...present.filter(([, n]) => n > 0).map(([c, n]) => `${c}: ${n} interview(s)`), ...(missing.length ? [`Not yet represented: ${missing.join(", ")}`] : [])],
  });

  b.push({ t: "h2", text: "4. Customer conversation summaries" });
  if (!N) b.push({ t: "p", text: "No eligible interviews yet." });
  for (const r of E) {
    const showName = i.includeNames && r.consent_identity && !!r.name;
    const clean = (s: string) => redact(s, showName ? "" : r.name, r.phone);
    b.push({ t: "h3", text: `${r.research_id}${showName ? `: ${r.name}` : ""} · ${r.category} · ${date(r.interview_date)}` });
    const items = [
      r.products_used.length ? `Products used: ${r.products_used.map(clean).join(", ")}` : null,
      ...NOTE_FIELDS.map(([k, label]) => (r[k] ? `${label}: ${clean(r[k])}` : null)),
    ].filter((x): x is string => !!x);
    b.push({ t: "ul", items });
    if (r.summary) b.push({ t: "p", text: `AI-assisted summary (from anonymised notes): ${r.summary.summary}` });
  }

  b.push({ t: "h2", text: "5. Key patterns" });
  if (!cross) b.push({ t: "p", text: "Not available until cross-interview analysis has been run." });
  else {
    const c = cross.content, total = c.meta.eligible_count;
    b.push({ t: "p", text: `Observed in the notes of ${total} interviews (analysis generated ${date(cross.created_at)}). Counts are based on verified quotations.` });
    if (c.themes.length) b.push({ t: "h3", text: "Themes" }, { t: "ul", items: c.themes.map((t) => `${t.title} (${t.interview_count} of ${total} interviews): ${t.description}`) });
    if (c.sentiment.positive.length) b.push({ t: "h3", text: "Positive sentiment" }, { t: "ul", items: c.sentiment.positive.map((s) => `${s.point} (${s.interview_count} of ${total})`) });
    if (c.sentiment.negative.length) b.push({ t: "h3", text: "Negative sentiment" }, { t: "ul", items: c.sentiment.negative.map((s) => `${s.point} (${s.interview_count} of ${total})`) });
    if (c.journey_friction.length) b.push({ t: "h3", text: "Customer journey friction" }, { t: "ul", items: c.journey_friction.map((f) => `${f.stage}: ${f.friction} (${f.interview_count} of ${total})`) });
    const quotes = c.problems.flatMap((p) => p.evidence.slice(0, 1));
    if (quotes.length) {
      b.push({ t: "h3", text: "Supporting customer statements (verbatim from notes)" });
      quotes.slice(0, 8).forEach((q) => b.push({ t: "quote", text: `“${q.quote}” (${q.ref})` }));
    }
  }

  b.push({ t: "h2", text: "6. Root-cause hypotheses" });
  const withCause = i.problems.filter((p) => p.root_cause);
  b.push(withCause.length
    ? { t: "ul", items: withCause.map((p) => `[Hypothesis] ${p.title}: ${p.root_cause}`) }
    : { t: "p", text: "No root-cause hypotheses recorded yet." });

  b.push({ t: "h2", text: "7. Problems considered" });
  const ranked = i.problems.map((p) => ({ p, s: priorityScore(p, N) })).sort((a, z) => z.s - a.s);
  b.push(ranked.length
    ? { t: "ul", items: ranked.map(({ p, s }) => `${p.title}: mentioned in ${Math.min(p.frequency_count, N)} of ${N} interviews · severity ${p.severity}/5 · customer impact ${p.customer_impact}/5 · tech feasibility ${p.tech_feasibility}/5 · priority ${s}/5${p.source === "ai" ? " (originally AI-suggested)" : ""}`) }
    : { t: "p", text: "No problems have been added to the workspace yet." });
  if (ranked.length) b.push({ t: "p", text: "Severity, impact and feasibility are researcher-reviewed estimates. Priority weights: frequency 30%, severity 25%, customer impact 25%, technology feasibility 20%." });

  b.push({ t: "h2", text: "8. Final problem statement" });
  const finalProblem = i.problems.find((p) => p.id === settings.final_problem_id);
  if (settings.final_statement) {
    b.push({ t: "p", text: settings.final_statement });
    if (finalProblem) b.push({ t: "p", text: `Selected problem: ${finalProblem.title}` });
  } else b.push({ t: "p", text: "Not yet selected." });

  b.push({ t: "h2", text: "9. Recommended improvements" });
  const recs = [...i.problems].filter((p) => p.recommendation).sort((a, z) => Number(z.id === settings.final_problem_id) - Number(a.id === settings.final_problem_id));
  b.push(recs.length
    ? { t: "ul", items: recs.map((p) => `${p.title}${p.id === settings.final_problem_id ? " (final problem)" : ""}: ${p.recommendation}`) }
    : { t: "p", text: "No recommendations recorded yet. These are proposals to validate, not findings." });

  return { blocks: b, warnings };
}

export function toMarkdown(blocks: Block[]): string {
  return blocks.map((b) => {
    switch (b.t) {
      case "h1": return `# ${b.text}`;
      case "h2": return `## ${b.text}`;
      case "h3": return `### ${b.text}`;
      case "quote": return `> ${b.text}`;
      case "ul": return b.items.map((x) => `- ${x}`).join("\n");
      default: return b.text;
    }
  }).join("\n\n") + "\n";
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]);

export function toHtml(blocks: Block[], title: string): string {
  const body = blocks.map((b) => {
    switch (b.t) {
      case "h1": case "h2": case "h3": return `<${b.t}>${esc(b.text)}</${b.t}>`;
      case "quote": return `<blockquote>${esc(b.text)}</blockquote>`;
      case "ul": return `<ul>${b.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
      default: return `<p>${esc(b.text)}</p>`;
    }
  }).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:780px;margin:40px auto;padding:0 20px;color:#0f172a}
h1{font-size:28px}h2{margin-top:32px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}h3{margin-top:20px}
blockquote{margin:8px 0;padding:6px 14px;border-left:3px solid #6366f1;background:#f8fafc}li{margin:4px 0}
@media print{body{margin:0}}</style></head><body>\n${body}\n</body></html>`;
}
