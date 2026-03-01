create table if not exists public.galleries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists galleries_user_id_idx on public.galleries(user_id);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists galleries_set_updated_at on public.galleries;
create trigger galleries_set_updated_at
before update on public.galleries
for each row
execute procedure public.set_updated_at_timestamp();

alter table public.drawings
  add column if not exists gallery_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'drawings_gallery_id_fkey'
      and conrelid = 'public.drawings'::regclass
  ) then
    alter table public.drawings
      add constraint drawings_gallery_id_fkey
      foreign key (gallery_id)
      references public.galleries(id)
      on delete set null;
  end if;
end $$;

create index if not exists drawings_gallery_id_idx on public.drawings(gallery_id);

alter table public.galleries enable row level security;

create policy "Users can read own galleries"
  on public.galleries
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own galleries"
  on public.galleries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own galleries"
  on public.galleries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own galleries"
  on public.galleries
  for delete
  to authenticated
  using (auth.uid() = user_id);
