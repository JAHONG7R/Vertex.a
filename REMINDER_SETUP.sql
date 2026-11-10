-- Vertex Web Push reminders. Run in Supabase SQL Editor.
create table if not exists public.vertex_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

create table if not exists public.vertex_reminders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  remind_at timestamptz not null,
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.vertex_push_subscriptions enable row level security;
alter table public.vertex_reminders enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.vertex_push_subscriptions;
create policy "Users manage own push subscriptions" on public.vertex_push_subscriptions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own reminders" on public.vertex_reminders;
create policy "Users manage own reminders" on public.vertex_reminders
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists vertex_reminders_due_idx on public.vertex_reminders(remind_at) where sent_at is null;
create index if not exists vertex_push_subscriptions_user_idx on public.vertex_push_subscriptions(user_id);
