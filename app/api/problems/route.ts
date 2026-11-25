import { NextResponse } from "next/server";
import { dbError, loadSettings } from "@/lib/data";
import { parse, requireUser, route } from "@/lib/http";
import { problemSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { supabase } = await requireUser();
  const [p, c, settings] = await Promise.all([
    supabase.from("problems").select("*").order("created_at", { ascending: false }),
    supabase.from("interviews").select("id", { count: "exact", head: true }).eq("status", "completed").eq("consent_feedback", true),
    loadSettings(supabase),
  ]);
  if (p.error) throw dbError(p.error);
  if (c.error) throw dbError(c.error);
  return NextResponse.json({ items: p.data ?? [], eligible_count: c.count ?? 0, settings });
});

export const POST = route(async (req: Request) => {
  const { supabase } = await requireUser();
  const input = await parse(req, problemSchema);
  const { data, error } = await supabase.from("problems").insert(input).select("id").single();
  if (error) throw dbError(error);
  return NextResponse.json({ id: data.id }, { status: 201 });
});
