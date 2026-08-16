alter table public.rm_records enable row level security;
alter table public.mr_records enable row level security;

revoke all on table public.rm_records from anon, authenticated;
revoke all on table public.mr_records from anon, authenticated;

grant select, insert, update, delete on table public.rm_records to anon, authenticated;
grant select, insert, update, delete on table public.mr_records to anon, authenticated;

drop policy if exists rm_records_select on public.rm_records;
create policy rm_records_select
  on public.rm_records
  for select
  to anon, authenticated
  using (true);

drop policy if exists rm_records_insert on public.rm_records;
create policy rm_records_insert
  on public.rm_records
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists rm_records_update on public.rm_records;
create policy rm_records_update
  on public.rm_records
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists rm_records_delete on public.rm_records;
create policy rm_records_delete
  on public.rm_records
  for delete
  to anon, authenticated
  using (true);

drop policy if exists mr_records_select on public.mr_records;
create policy mr_records_select
  on public.mr_records
  for select
  to anon, authenticated
  using (true);

drop policy if exists mr_records_insert on public.mr_records;
create policy mr_records_insert
  on public.mr_records
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists mr_records_update on public.mr_records;
create policy mr_records_update
  on public.mr_records
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists mr_records_delete on public.mr_records;
create policy mr_records_delete
  on public.mr_records
  for delete
  to anon, authenticated
  using (true);
