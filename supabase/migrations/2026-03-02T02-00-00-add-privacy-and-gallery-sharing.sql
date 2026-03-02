create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  searchable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_username_idx on public.user_profiles(username);
create index if not exists user_profiles_searchable_idx on public.user_profiles(searchable);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can read profiles for search" on public.user_profiles;
create policy "Users can read profiles for search"
  on public.user_profiles
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or searchable = true
  );

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.gallery_shares (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  shared_with_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (gallery_id, shared_with_user_id)
);

create index if not exists gallery_shares_gallery_id_idx on public.gallery_shares(gallery_id);
create index if not exists gallery_shares_owner_user_id_idx on public.gallery_shares(owner_user_id);
create index if not exists gallery_shares_shared_with_user_id_idx on public.gallery_shares(shared_with_user_id);

alter table public.gallery_shares enable row level security;

drop policy if exists "Owners and recipients can read gallery shares" on public.gallery_shares;
create policy "Owners and recipients can read gallery shares"
  on public.gallery_shares
  for select
  to authenticated
  using (
    auth.uid() = owner_user_id
    or auth.uid() = shared_with_user_id
  );

drop policy if exists "Owners can insert gallery shares" on public.gallery_shares;
create policy "Owners can insert gallery shares"
  on public.gallery_shares
  for insert
  to authenticated
  with check (
    auth.uid() = owner_user_id
    and shared_with_user_id <> auth.uid()
    and exists (
      select 1
      from public.galleries g
      where g.id = gallery_id
        and g.user_id = auth.uid()
    )
  );

drop policy if exists "Owners can delete gallery shares" on public.gallery_shares;
create policy "Owners can delete gallery shares"
  on public.gallery_shares
  for delete
  to authenticated
  using (auth.uid() = owner_user_id);

create or replace function public.sync_user_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, username)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (user_id) do update
  set username = excluded.username,
      updated_at = now();

  return new;
end;
$$;

alter function public.sync_user_profile_from_auth_user() set search_path = public;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute procedure public.sync_user_profile_from_auth_user();

insert into public.user_profiles (user_id, username, searchable)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
    split_part(u.email, '@', 1)
  ) as username,
  true
from auth.users u
on conflict (user_id) do update
set username = excluded.username,
    updated_at = now();

update public.user_profiles
set updated_at = now()
where updated_at is null;

drop policy if exists "Users can read own galleries" on public.galleries;
create policy "Users can read own or shared galleries"
  on public.galleries
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.gallery_shares gs
      where gs.gallery_id = galleries.id
        and gs.shared_with_user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own drawings" on public.drawings;
create policy "Users can read own or shared drawings"
  on public.drawings
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or (
      gallery_id is not null
      and exists (
        select 1
        from public.gallery_shares gs
        where gs.gallery_id = drawings.gallery_id
          and gs.shared_with_user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can insert own drawings" on public.drawings;
create policy "Users can insert own drawings"
  on public.drawings
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      gallery_id is null
      or exists (
        select 1
        from public.galleries g
        where g.id = drawings.gallery_id
          and g.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update own drawings" on public.drawings;
create policy "Users can update own drawings"
  on public.drawings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      gallery_id is null
      or exists (
        select 1
        from public.galleries g
        where g.id = drawings.gallery_id
          and g.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can read own drawing objects" on storage.objects;
create policy "Users can read own or shared drawing objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'drawings'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.drawings d
        join public.gallery_shares gs
          on gs.gallery_id = d.gallery_id
        where d.storage_path = name
          and gs.shared_with_user_id = auth.uid()
      )
    )
  );
