alter table public.purchase_orders enable row level security;

revoke all on table public.purchase_orders from anon, authenticated;
grant select, insert, update, delete on table public.purchase_orders to anon, authenticated;
revoke truncate, references, trigger on table public.purchase_orders from anon, authenticated;

drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select
  on public.purchase_orders
  for select
  to anon, authenticated
  using (true);

drop policy if exists purchase_orders_insert on public.purchase_orders;
create policy purchase_orders_insert
  on public.purchase_orders
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists purchase_orders_update on public.purchase_orders;
create policy purchase_orders_update
  on public.purchase_orders
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists purchase_orders_delete on public.purchase_orders;
create policy purchase_orders_delete
  on public.purchase_orders
  for delete
  to anon, authenticated
  using (true);

create or replace function public.execute_po_in_transaction(
  p_po_id text,
  p_transaction_id text,
  p_quantity numeric,
  p_date text,
  p_remarks text,
  p_user text
) returns boolean
language plpgsql
security invoker
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_new_in_qty numeric;
  v_current_out_qty numeric;
  v_new_status text;
  v_now timestamptz := now();
  v_user text := coalesce(nullif(btrim(p_user), ''), 'System');
begin
  if coalesce(nullif(btrim(p_po_id), ''), '') = '' then
    raise exception 'Purchase Order ID is required';
  end if;

  if coalesce(nullif(btrim(p_transaction_id), ''), '') = '' then
    raise exception 'Transaction ID is required';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than 0';
  end if;

  if coalesce(nullif(btrim(p_date), ''), '') = '' then
    raise exception 'Transaction date is required';
  end if;

  select *
    into v_po
  from public.purchase_orders
  where firestore_document_id = p_po_id
  for update;

  if not found then
    raise exception 'Purchase Order not found';
  end if;

  v_new_in_qty := coalesce(v_po.in_qty, 0) + p_quantity;
  v_current_out_qty := coalesce(v_po.out_qty, 0);
  v_new_status := v_po.status;

  if v_new_status is distinct from 'CANCELLED' and v_new_status is distinct from 'CLOSED' then
    if v_current_out_qty >= coalesce(v_po.order_qty, 0) then
      v_new_status := 'CLOSED';
    elsif v_current_out_qty > 0 or v_new_in_qty > 0 then
      v_new_status := 'PARTIAL';
    else
      v_new_status := 'OPEN';
    end if;
  end if;

  update public.purchase_orders
  set in_qty = v_new_in_qty,
      status = v_new_status,
      updated_by = v_user,
      updated_at = v_now,
      raw_data = coalesce(v_po.raw_data, '{}'::jsonb) || jsonb_build_object(
        'inQty', v_new_in_qty,
        'status', v_new_status,
        'updatedBy', v_user,
        'updatedAt', v_now
      )
  where firestore_document_id = p_po_id;

  insert into public.po_transactions (
    firestore_document_id,
    po_id,
    type,
    quantity,
    transaction_date,
    remarks,
    reference_id,
    performed_by,
    created_at,
    raw_data,
    imported_at,
    synced_at
  ) values (
    p_transaction_id,
    p_po_id,
    'IN',
    p_quantity,
    p_date,
    coalesce(p_remarks, ''),
    null,
    v_user,
    v_now,
    jsonb_build_object(
      'poId', p_po_id,
      'type', 'IN',
      'quantity', p_quantity,
      'date', p_date,
      'remarks', coalesce(p_remarks, ''),
      'referenceId', null,
      'performedBy', v_user,
      'createdAt', v_now
    ),
    now(),
    now()
  );

  return true;
end;
$$;

grant execute on function public.execute_po_in_transaction(text, text, numeric, text, text, text) to anon, authenticated;