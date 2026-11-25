# Man Matters Customer Intelligence Hub

Customer research workspace: interview management, Groq-powered analysis, problem prioritisation, exportable report.
Stack: Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) · Groq · Vercel.

## Setup
1. `npm install`
2. Create a Supabase project. In **SQL Editor**, run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key and your Groq key (`GROQ_API_KEY` is server-only).
4. In Supabase **Authentication**: create your account (or use Sign up on /login). Then disable public sign-ups so nobody else can register.
5. `npm run dev` and open http://localhost:3000.

## Deploy to Vercel
1. Push to GitHub and import the repo in Vercel (no vercel.json is needed; AI routes set `maxDuration = 60`).
2. Add the four environment variables from `.env.example`. Do not mark the Supabase ones secret-only; they must be public.
3. In Supabase, set Authentication > URL Configuration > Site URL to your Vercel domain.

## How privacy works
- Names and phones live in `participants`; AI routes never select that table into prompts. It is read only to redact those exact strings, plus phone- and email-like patterns, from the notes.
- Interviews are sent to Groq under aliases (INT-1…), not research IDs.
- RLS: every table is restricted to `user_id = auth.uid()`; `anon` has no access.
- Request bodies and AI responses are never logged (only error codes).
- Reports never contain phone numbers. Names appear only if `consent_identity` is true and the "include names" box is ticked.

## How the AI stays honest
- Cross-interview analysis is refused server-side below 3 completed interviews with feedback consent. The UI shows the live count.
- Every quote the model returns is verified as verbatim text in the redacted notes; unverifiable quotes and unsupported items are discarded.
- "Mentioned in X of N interviews" is computed from verified quotes, never taken from the model.
- Root causes, recommendations and severity/impact/feasibility scores are labelled hypotheses/estimates.

## Manual test checklist
1. Sign up/in; unauthenticated visits to `/` redirect to `/login`.
2. Dashboard shows empty states with zero data.
3. Create a draft interview (validation errors show; ID is unique). Edit it. Mark completed (needs products + notes).
4. Consent: tick identity without feedback to see the validation error.
5. Generate an AI summary; check that name/phone typed into the notes appear as [participant]/[phone] in nothing the model returns.
6. With <3 eligible interviews the analysis page is locked, and POST `/api/ai/cross-analysis` returns 422.
7. Add 3+ eligible interviews, run analysis, add a problem to the workspace, adjust scores, choose the final statement.
8. Report preview shows warnings; the Markdown download has no phone numbers and names only for consented participants.
9. In a second Supabase account, confirm you cannot see the first account's rows.
