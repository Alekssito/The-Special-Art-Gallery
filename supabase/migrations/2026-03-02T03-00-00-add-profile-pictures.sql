alter table public.user_profiles
  add column if not exists avatar_path text;

do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'profile-pictures'
  ) then
    insert into storage.buckets (id, name, public)
    values ('profile-pictures', 'profile-pictures', false);
  end if;
end $$;

drop policy if exists "Authenticated users can read profile pictures" on storage.objects;
create policy "Authenticated users can read profile pictures"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'profile-pictures');

drop policy if exists "Users can upload own profile pictures" on storage.objects;
create policy "Users can upload own profile pictures"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own profile pictures" on storage.objects;
create policy "Users can update own profile pictures"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own profile pictures" on storage.objects;
create policy "Users can delete own profile pictures"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );