import { NextResponse } from "next/server";
import { dbError } from "@/lib/data";
import { AppError, parse, requireUser, route } from "@/lib/http";
import { idSchema, interviewSchema, statusSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };
const idOf = (c: Ctx) => {
  const r = idSchema.safeParse(c.params.id);
  if (!r.success) throw new AppError(404, "Interview not found");
  return r.data;
};
const one = (v: any) => (Array.isArray(v) ? v[0] : v);

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const id = idOf(ctx);
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("interviews").select("*, participants(name, phone)").eq("id", id).maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw new AppError(404, "Interview not found");
  const { participants, ...rest } = data as any;
  const s = await supabase.from("analyses").select("id, created_at, model, evidence_count, content")
    .eq("kind", "summary").eq("interview_id", id).order("created_at", { ascending: false }).limit(1);
  if (s.error) throw dbError(s.error);
  return NextResponse.json({
    interview: { ...rest, participant_name: one(participants)?.name ?? "", phone: one(participants)?.phone ?? "" },
    summary: s.data?.[0] ?? null,
  });
});

export const PUT = route(async (req: Request, ctx: Ctx) => {
  const id = idOf(ctx);
  const { supabase } = await requireUser();
  const { participant_name, phone, ...fields } = await parse(req, interviewSchema);
  const { data, error } = await supabase.from("interviews").update(fields).eq("id", id).select("id");
  if (error) throw dbError(error);
  if (!data?.length) throw new AppError(404, "Interview not found");
  const p = await supabase.from("participants").upsert({ interview_id: id, name: participant_name, phone }, { onConflict: "interview_id" });
  if (p.error) throw dbError(p.error);
  return NextResponse.json({ id });
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const id = idOf(ctx);
  const { supabase } = await requireUser();
  const { status } = await parse(req, statusSchema);
  if (status === "completed") {
    const { data, error } = await supabase.from("interviews").select("products_used, liked, disliked, difficulties").eq("id", id).maybeSingle();
    if (error) throw dbError(error);
    if (!data) throw new AppError(404, "Interview not found");
    if (!data.products_used.length || ![data.liked, data.disliked, data.difficulties].some(Boolean))
      throw new AppError(422, "Add products and at least one of liked / disliked / difficulties before completing this interview.");
  }
  const { error } = await supabase.from("interviews").update({ status }).eq("id", id);
  if (error) throw dbError(error);
  return NextResponse.json({ id, status });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const id = idOf(ctx);
  const { supabase } = await requireUser();
  const { error } = await supabase.from("interviews").delete().eq("id", id);
  if (error) throw dbError(error);
  return NextResponse.json({ ok: true });
});
