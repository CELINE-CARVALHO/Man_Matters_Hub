import type { z } from "zod";
import { AppError } from "./http";

export async function groqJSON<T>(system: string, user: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>) {
  const key = process.env.GROQ_API_KEY; // server-only
  if (!key) throw new AppError(500, "AI is not configured. Set GROQ_API_KEY on the server.");
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model, temperature: 0.2, response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      throw new AppError(504, "The AI provider took too long to respond. Please try again.");
    }
    if (res.status === 429) throw new AppError(429, "AI rate limit reached. Wait a moment and try again.");
    if (!res.ok) throw new AppError(502, `The AI provider returned an error (${res.status}).`); // body never logged
    const json = await res.json();
    try {
      return { data: schema.parse(JSON.parse(String(json?.choices?.[0]?.message?.content))), model };
    } catch { /* malformed JSON → retry once */ }
  }
  throw new AppError(502, "The AI returned an unusable response. Please try again.");
}
