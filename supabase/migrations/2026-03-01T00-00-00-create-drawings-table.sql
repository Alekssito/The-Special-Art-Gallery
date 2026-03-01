create extension if not exists pgcrypto;

create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  image_data text not null,
  created_at timestamptz not null default now()
);

alter table public.drawings enable row level security;

create policy "Users can read own drawings"
  on public.drawings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own drawings"
  on public.drawings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own drawings"
  on public.drawings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own drawings"
  on public.drawings
  for delete
  to authenticated
  using (auth.uid() = user_id);
