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
