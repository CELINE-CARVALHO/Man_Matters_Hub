import { NextResponse } from "next/server";
import { CATEGORIES, NOTE_FIELDS } from "@/lib/constants";
import { dbError } from "@/lib/data";
import { parse, requireUser, route } from "@/lib/http";
import { interviewSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
const one = (v: any) => (Array.isArray(v) ? v[0] : v);

export const GET = route(async (req: Request) => {
  const { supabase } = await requireUser();
  const sp = new URL(req.url).searchParams;
  const category = sp.get("category"), status = sp.get("status");
  const q = (sp.get("q") ?? "").trim().toLowerCase().slice(0, 100);

  let query = supabase.from("interviews").select("*, participants(name)")
    .order("interview_date", { ascending: false }).order("created_at", { ascending: false });
  if (category && (CATEGORIES as readonly string[]).includes(category)) query = query.eq("category", category);
  if (status === "draft" || status === "completed") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw dbError(error);

  let items = ((data ?? []) as any[]).map(({ participants, ...r }) => ({ ...r, _name: one(participants)?.name ?? "" }));
  if (q) {
    items = items.filter((r) =>
      [r.research_id, r.category, r.products_used.join(" "), r._name, ...NOTE_FIELDS.map(([k]) => r[k])].join(" ").toLowerCase().includes(q));
  }
  return NextResponse.json({ items: items.map(({ _name, ...r }) => r) }); // names are used for matching only, never returned in the list
});

export const POST = route(async (req: Request) => {
  const { supabase } = await requireUser();
  const { participant_name, phone, ...fields } = await parse(req, interviewSchema);
  const { data, error } = await supabase.from("interviews").insert(fields).select("id").single();
  if (error) throw dbError(error);
  const p = await supabase.from("participants").insert({ interview_id: data.id, name: participant_name, phone });
  if (p.error) { await supabase.from("interviews").delete().eq("id", data.id); throw dbError(p.error); }
  return NextResponse.json({ id: data.id }, { status: 201 });
});
