import { NextResponse } from "next/server";
import { dbError } from "@/lib/data";
import { AppError, parse, requireUser, route } from "@/lib/http";
import { idSchema, problemUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };
const idOf = (c: Ctx) => {
  const r = idSchema.safeParse(c.params.id);
  if (!r.success) throw new AppError(404, "Problem not found");
  return r.data;
};

export const PUT = route(async (req: Request, ctx: Ctx) => {
  const id = idOf(ctx);
  const { supabase } = await requireUser();
  const input = await parse(req, problemUpdateSchema);
  const { data, error } = await supabase.from("problems").update(input).eq("id", id).select("id");
  if (error) throw dbError(error);
  if (!data?.length) throw new AppError(404, "Problem not found");
  return NextResponse.json({ id });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const id = idOf(ctx);
  const { supabase } = await requireUser();
  const { error } = await supabase.from("problems").delete().eq("id", id);
  if (error) throw dbError(error);
  return NextResponse.json({ ok: true });
});
