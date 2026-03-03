alter table public.user_profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists user_profiles_is_admin_idx
  on public.user_profiles(is_admin);

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.user_id = check_user_id
      and up.is_admin = true
  );
$$;

alter function public.is_admin(uuid) set search_path = public;

drop policy if exists "Users can read profiles for search" on public.user_profiles;
create policy "Users can read profiles for search"
  on public.user_profiles
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or searchable = true
    or public.is_admin(auth.uid())
  );

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
  );

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own or any profile as admin"
  on public.user_profiles
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
  )
  with check (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
  );

drop policy if exists "Users can read own or shared galleries" on public.galleries;
create policy "Users can read own or shared galleries"
  on public.galleries
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
    or exists (
      select 1
      from public.gallery_shares gs
      where gs.gallery_id = galleries.id
        and gs.shared_with_user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own galleries" on public.galleries;
create policy "Users can insert own or any galleries as admin"
  on public.galleries
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
  );

drop policy if exists "Users can update own galleries" on public.galleries;
create policy "Users can update own or any galleries as admin"
  on public.galleries
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
  )
  with check (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
  );

drop policy if exists "Users can delete own galleries" on public.galleries;
create policy "Users can delete own or any galleries as admin"
  on public.galleries
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
  );

drop policy if exists "Users can read own or shared drawings" on public.drawings;
create policy "Users can read own or shared drawings"
  on public.drawings
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
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
create policy "Users can insert own or any drawings as admin"
  on public.drawings
  for insert
  to authenticated
  with check (
    (auth.uid() = user_id and (
      gallery_id is null
      or exists (
        select 1
        from public.galleries g
        where g.id = drawings.gallery_id
          and g.user_id = auth.uid()
      )
    ))
    or public.is_admin(auth.uid())
  );

drop policy if exists "Users can update own drawings" on public.drawings;
create policy "Users can update own or any drawings as admin"
  on public.drawings
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
  )
  with check (
    (auth.uid() = user_id and (
      gallery_id is null
      or exists (
        select 1
        from public.galleries g
        where g.id = drawings.gallery_id
          and g.user_id = auth.uid()
      )
    ))
    or public.is_admin(auth.uid())
  );

drop policy if exists "Users can delete own drawings" on public.drawings;
create policy "Users can delete own or any drawings as admin"
  on public.drawings
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_admin(auth.uid())
  );

drop policy if exists "Owners and recipients can read gallery shares" on public.gallery_shares;
create policy "Owners and recipients can read gallery shares"
  on public.gallery_shares
  for select
  to authenticated
  using (
    auth.uid() = owner_user_id
    or auth.uid() = shared_with_user_id
    or public.is_admin(auth.uid())
  );

drop policy if exists "Owners can insert gallery shares" on public.gallery_shares;
create policy "Owners or admins can insert gallery shares"
  on public.gallery_shares
  for insert
  to authenticated
  with check (
    (
      auth.uid() = owner_user_id
      and shared_with_user_id <> auth.uid()
      and exists (
        select 1
        from public.galleries g
        where g.id = gallery_id
          and g.user_id = auth.uid()
      )
    )
    or public.is_admin(auth.uid())
  );

drop policy if exists "Owners can delete gallery shares" on public.gallery_shares;
create policy "Owners or admins can delete gallery shares"
  on public.gallery_shares
  for delete
  to authenticated
  using (
    auth.uid() = owner_user_id
    or public.is_admin(auth.uid())
  );

drop policy if exists "Users can read own drawing objects" on storage.objects;
drop policy if exists "Users can read own or shared drawing objects" on storage.objects;
create policy "Users can read own or shared drawing objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'drawings'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
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

drop policy if exists "Users can insert own drawing objects" on storage.objects;
create policy "Users can insert own or any drawing objects as admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'drawings'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "Users can update own drawing objects" on storage.objects;
create policy "Users can update own or any drawing objects as admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'drawings'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  )
  with check (
    bucket_id = 'drawings'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "Users can delete own drawing objects" on storage.objects;
create policy "Users can delete own or any drawing objects as admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'drawings'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "Authenticated users can read profile pictures" on storage.objects;
create policy "Authenticated users can read profile pictures"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'profile-pictures');

drop policy if exists "Users can upload own profile pictures" on storage.objects;
create policy "Users can upload own or any profile pictures as admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-pictures'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "Users can update own profile pictures" on storage.objects;
create policy "Users can update own or any profile pictures as admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  )
  with check (
    bucket_id = 'profile-pictures'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "Users can delete own profile pictures" on storage.objects;
create policy "Users can delete own or any profile pictures as admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  );
