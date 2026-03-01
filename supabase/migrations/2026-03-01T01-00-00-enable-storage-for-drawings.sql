alter table public.drawings
  alter column image_data drop not null;

alter table public.drawings
  add column if not exists storage_path text;

do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'drawings'
  ) then
    insert into storage.buckets (id, name, public)
    values ('drawings', 'drawings', false);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can read own drawing objects'
  ) then
    create policy "Users can read own drawing objects"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'drawings'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can insert own drawing objects'
  ) then
    create policy "Users can insert own drawing objects"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'drawings'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update own drawing objects'
  ) then
    create policy "Users can update own drawing objects"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'drawings'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'drawings'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete own drawing objects'
  ) then
    create policy "Users can delete own drawing objects"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'drawings'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
