create extension if not exists pgcrypto;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  research_id text not null,
  -- Consent 1: agreed to take part AND to have their feedback used/shared with Mosaic
  consent_feedback boolean not null default false,
  -- Consent 2 (separate): agreed that their NAME may be shared with Mosaic
  consent_identity boolean not null default false,
  products_used text[] not null default '{}',
  category text not null check (category in ('Haircare','Skincare','Beard Care','Supplements/Wellness')),
  purchase_motivation text not null default '',
  liked text not null default '',
  disliked text not null default '',
  difficulties text not null default '',
  expectations text not null default '',
  incidents text not null default '',
  observations text not null default '',
  interview_date date not null,
  status text not null default 'draft' check (status in ('draft','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, research_id)
);

-- Private identity data lives apart so AI/report queries never touch it by accident
create table public.participants (
  interview_id uuid primary key references public.interviews(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default ''
);

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  root_cause text not null default '',
  recommendation text not null default '',
  frequency_count int not null default 0 check (frequency_count >= 0),
  severity int not null default 3 check (severity between 1 and 5),
  customer_impact int not null default 3 check (customer_impact between 1 and 5),
  tech_feasibility int not null default 3 check (tech_feasibility between 1 and 5),
  source text not null default 'manual' check (source in ('manual','ai')),
  evidence jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.research_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  brand text not null default 'Man Matters',
  target_interviews int not null default 5 check (target_interviews between 1 and 100),
  final_problem_id uuid references public.problems(id) on delete set null,
  final_statement text,
  updated_at timestamptz not null default now()
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('summary','cross')),
  interview_id uuid references public.interviews(id) on delete cascade,
  evidence_count int not null,
  model text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index on public.interviews (user_id, status);
create index on public.analyses (user_id, kind, created_at desc);
create index on public.analyses (interview_id);

create trigger t_interviews before update on public.interviews for each row execute function public.touch_updated_at();
create trigger t_problems before update on public.problems for each row execute function public.touch_updated_at();
create trigger t_settings before update on public.research_settings for each row execute function public.touch_updated_at();

-- Row Level Security: every row belongs to exactly one user
alter table public.interviews enable row level security;
alter table public.participants enable row level security;
alter table public.problems enable row level security;
alter table public.research_settings enable row level security;
alter table public.analyses enable row level security;

create policy "own rows" on public.interviews for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.problems for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.research_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.analyses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.participants for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.interviews i where i.id = interview_id and i.user_id = auth.uid()));

revoke all on public.interviews, public.participants, public.problems, public.research_settings, public.analyses from anon;
