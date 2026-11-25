import { NOTE_FIELDS } from "./constants";
import type { InterviewRow } from "./types";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Removes the participant's name/phone and any phone/email-looking strings from free text. */
export function redact(text: string, name = "", phone = ""): string {
  let out = text;
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/).filter((p) => p.length >= 3);
    for (const p of [n, ...parts].sort((a, b) => b.length - a.length)) {
      out = out.replace(new RegExp(esc(p), "gi"), "[participant]");
    }
  }
  if (phone.trim().length >= 6) out = out.split(phone.trim()).join("[phone]");
  out = out.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]");
  out = out.replace(/\+?\d[\d\s().-]{6,}\d/g, (m) => (m.replace(/\D/g, "").length >= 9 ? "[phone]" : m));
  return out;
}

export type Sanitised = { alias: string; id: string; research_id: string; text: string; corpus: string };

/** Builds anonymised text for the AI. Aliases (INT-1…) replace research IDs; identities never enter. */
export function sanitise(rows: InterviewRow[], people: Map<string, { name: string; phone: string }>): Sanitised[] {
  return rows.map((r, i) => {
    const p = people.get(r.id) ?? { name: "", phone: "" };
    const clean = (s: string) => redact(s, p.name, p.phone);
    const alias = `INT-${i + 1}`;
    const products = r.products_used.map(clean).join(", ");
    const fields = NOTE_FIELDS.filter(([k]) => r[k]).map(([k, label]) => ({ label, value: clean(r[k]) }));
    const text = `=== ${alias} | category: ${r.category} | products: ${products || "n/a"} ===\n` +
      fields.map((f) => `${f.label}: ${f.value}`).join("\n");
    const corpus = [products, ...fields.map((f) => f.value)].join("\n");
    return { alias, id: r.id, research_id: r.research_id, text, corpus };
  });
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

/** True only if the quote appears verbatim (ignoring case/whitespace/quote style) in the source notes. */
export function quoteInCorpus(quote: string, corpus: string): boolean {
  const q = norm(quote).replace(/^[\s"'…. ]+|[\s"'…. ]+$/g, "");
  return q.length >= 8 && norm(corpus).includes(q);
}
