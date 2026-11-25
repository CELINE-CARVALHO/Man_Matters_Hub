import { NextResponse } from "next/server";
import { dbError, loadSettings } from "@/lib/data";
import { AppError, parse, requireUser, route } from "@/lib/http";
import { settingsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const { supabase } = await requireUser();
  return NextResponse.json(await loadSettings(supabase));
});

export const PUT = route(async (req: Request) => {
  const { supabase, user } = await requireUser();
  const input = await parse(req, settingsSchema);
  if (input.final_problem_id) {
    const { data, error } = await supabase.from("problems").select("id").eq("id", input.final_problem_id).maybeSingle();
    if (error) throw dbError(error);
    if (!data) throw new AppError(422, "Selected problem no longer exists.");
  }
  const { error } = await supabase.from("research_settings")
    .upsert({ user_id: user.id, ...input, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw dbError(error);
  return NextResponse.json(await loadSettings(supabase));
});
