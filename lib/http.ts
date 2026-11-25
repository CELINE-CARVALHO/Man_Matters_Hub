import { NextResponse } from "next/server";
import type { z } from "zod";
import { supabaseServer } from "./supabase/server";

export class AppError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

/** Wraps a handler: consistent JSON errors, and nothing about the request body is ever logged. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try { return await fn(...args); }
    catch (e) {
      if (e instanceof AppError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
      console.error("Unhandled API error:", e instanceof Error ? e.name : "unknown");
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function requireUser() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AppError(401, "Not signed in");
  return { supabase, user };
}

export async function parse<T>(req: Request, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  let body: unknown;
  try { body = await req.json(); } catch { throw new AppError(400, "Request body must be valid JSON"); }
  const r = schema.safeParse(body);
  if (!r.success) throw new AppError(422, "Please check the highlighted fields", r.error.flatten().fieldErrors);
  return r.data;
}
