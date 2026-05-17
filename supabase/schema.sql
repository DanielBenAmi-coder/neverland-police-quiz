-- הריצו ב-Supabase → SQL Editor (פרויקט חינמי ב-supabase.com)

create table if not exists public.activity_logs (
  id text primary key,
  ts timestamptz not null default now(),
  name text not null,
  event text not null,
  session_id text,
  mode text,
  rank text,
  category text,
  score int,
  passed boolean,
  questions int,
  label text
);

create index if not exists activity_logs_name_idx on public.activity_logs (name);
create index if not exists activity_logs_ts_idx on public.activity_logs (ts desc);

alter table public.activity_logs enable row level security;

drop policy if exists "allow_insert_logs" on public.activity_logs;
create policy "allow_insert_logs" on public.activity_logs
  for insert to anon, authenticated with check (true);

drop policy if exists "allow_read_logs" on public.activity_logs;
create policy "allow_read_logs" on public.activity_logs
  for select to anon, authenticated using (true);

-- היסטוריית בחינות (ציונים + טעויות)
create table if not exists public.quiz_history (
  id text primary key,
  ts timestamptz not null default now(),
  name text not null,
  mode text,
  rank text,
  category text,
  label text,
  score int,
  passed boolean,
  total int,
  correct_count int,
  wrongs jsonb default '[]'::jsonb
);

create index if not exists quiz_history_name_idx on public.quiz_history (name);
create index if not exists quiz_history_ts_idx on public.quiz_history (ts desc);

alter table public.quiz_history enable row level security;

drop policy if exists "allow_insert_history" on public.quiz_history;
create policy "allow_insert_history" on public.quiz_history
  for insert to anon, authenticated with check (true);

drop policy if exists "allow_read_history" on public.quiz_history;
create policy "allow_read_history" on public.quiz_history
  for select to anon, authenticated using (true);
