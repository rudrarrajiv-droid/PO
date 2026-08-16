alter table public.metadata enable row level security;

revoke insert, update, delete, truncate, references, trigger
  on table public.metadata
  from anon, authenticated;

grant select on table public.metadata to anon, authenticated;

drop policy if exists metadata_select on public.metadata;
create policy metadata_select
  on public.metadata
  for select
  to anon, authenticated
  using (true);