alter table public.finish_goods enable row level security;
alter table public.finish_good_transactions enable row level security;

revoke all on table public.finish_goods from anon, authenticated;
grant select on table public.finish_goods to anon, authenticated;

revoke all on table public.finish_good_transactions from anon, authenticated;
grant select on table public.finish_good_transactions to anon, authenticated;

drop policy if exists finish_goods_select on public.finish_goods;
create policy finish_goods_select
  on public.finish_goods
  for select
  to anon, authenticated
  using (true);

drop policy if exists finish_good_transactions_select on public.finish_good_transactions;
create policy finish_good_transactions_select
  on public.finish_good_transactions
  for select
  to anon, authenticated
  using (true);

create or replace function public.execute_finish_good_outward_transaction(
  p_logistics jsonb,
  p_payloads jsonb,
  p_user text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_user text := coalesce(nullif(btrim(p_user), ''), 'System');
  v_payload jsonb;
  v_product_id text;
  v_quantity numeric;
  v_category text;
  v_transaction_id text;
  v_loaded_fg_ids text[] := '{}';
  v_fg_snapshots jsonb := '{}'::jsonb;
  v_fg public.finish_goods%rowtype;
  v_fg_json jsonb;
  v_in_qty numeric;
  v_out_qty numeric;
  v_closing_balance numeric;
  v_non_moving_balance numeric;
  v_new_out_qty numeric;
  v_new_closing_balance numeric;
  v_new_non_moving_balance numeric;
  v_remaining_balance numeric;
begin
  if p_payloads is null or jsonb_typeof(p_payloads) <> 'array' or jsonb_array_length(p_payloads) = 0 then
    raise exception 'At least one finish goods outward row is required';
  end if;

  for v_payload in select value from jsonb_array_elements(p_payloads) loop
    v_product_id := nullif(btrim(coalesce(v_payload ->> 'productId', '')), '');

    if v_product_id is null then
      raise exception 'Finish Good product ID is required';
    end if;

    if not coalesce(v_product_id = any(v_loaded_fg_ids), false) then
      select *
        into v_fg
      from public.finish_goods
      where firestore_document_id = v_product_id
      for update;

      if not found then
        raise exception 'Finish Good record not found for product %', v_product_id;
      end if;

      v_fg_snapshots := v_fg_snapshots || jsonb_build_object(v_product_id, to_jsonb(v_fg));
      v_loaded_fg_ids := array_append(v_loaded_fg_ids, v_product_id);
    end if;
  end loop;

  for v_payload in select value from jsonb_array_elements(p_payloads) loop
    v_product_id := nullif(btrim(coalesce(v_payload ->> 'productId', '')), '');
    v_quantity := coalesce(nullif(v_payload ->> 'quantity', '')::numeric, 0);
    v_category := coalesce(v_payload ->> 'category', '');
    v_transaction_id := nullif(btrim(coalesce(v_payload ->> 'transactionId', '')), '');

    if v_transaction_id is null then
      raise exception 'Finish Good transaction ID is required';
    end if;

    v_fg_json := v_fg_snapshots -> v_product_id;
    v_in_qty := coalesce(nullif(v_fg_json ->> 'in_qty', '')::numeric, 0);
    v_out_qty := coalesce(nullif(v_fg_json ->> 'out_qty', '')::numeric, 0);
    v_closing_balance := coalesce(nullif(v_fg_json ->> 'closing_balance', '')::numeric, 0);
    v_non_moving_balance := coalesce(nullif(v_fg_json ->> 'non_moving_balance', '')::numeric, 0);
    v_new_out_qty := v_out_qty + v_quantity;
    v_new_closing_balance := v_closing_balance;
    v_new_non_moving_balance := v_non_moving_balance;

    if v_category = 'DISPATCH' then
      if v_new_closing_balance < v_quantity then
        raise exception 'Insufficient Regular Balance for product %', coalesce(v_fg_json #>> '{raw_data,productName}', v_fg_json ->> 'product_name', v_product_id);
      end if;
      v_new_closing_balance := v_new_closing_balance - v_quantity;
    elsif v_category = 'NON-MOVING' then
      if v_new_non_moving_balance < v_quantity then
        raise exception 'Insufficient Non-Moving Balance for product %', coalesce(v_fg_json #>> '{raw_data,productName}', v_fg_json ->> 'product_name', v_product_id);
      end if;
      v_new_non_moving_balance := v_new_non_moving_balance - v_quantity;
    end if;

    update public.finish_goods
    set out_qty = v_new_out_qty,
        closing_balance = v_new_closing_balance,
        non_moving_balance = v_new_non_moving_balance,
        updated_at = v_now,
        updated_by = v_user,
        raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object(
          'outQty', v_new_out_qty,
          'closingBalance', v_new_closing_balance,
          'nonMovingBalance', v_new_non_moving_balance,
          'updatedAt', v_now,
          'updatedBy', v_user
        )
    where firestore_document_id = v_product_id;

    v_remaining_balance := case when v_category = 'DISPATCH' then v_new_closing_balance else v_new_non_moving_balance end;

    insert into public.finish_good_transactions (
      firestore_document_id,
      finish_good_id,
      type,
      category,
      quantity,
      remaining_balance,
      rate,
      transaction_date,
      reference_id,
      reference_no,
      invoice_no,
      place,
      transporter_name,
      vehicle_no,
      vehicle_size,
      freight,
      holding,
      point,
      others,
      receiving_status,
      receiving_confirmed_at,
      receiving_confirmed_by,
      performed_by,
      created_by,
      updated_by,
      created_at,
      updated_at,
      is_archived,
      raw_data,
      imported_at,
      synced_at
    ) values (
      v_transaction_id,
      v_product_id,
      'OUT',
      nullif(v_category, ''),
      v_quantity,
      v_remaining_balance,
      null,
      nullif(p_logistics ->> 'date', ''),
      null,
      nullif(p_logistics ->> 'invoiceNo', ''),
      nullif(p_logistics ->> 'invoiceNo', ''),
      nullif(p_logistics ->> 'place', ''),
      nullif(p_logistics ->> 'transporterName', ''),
      nullif(p_logistics ->> 'vehicleNo', ''),
      nullif(p_logistics ->> 'vehicleSize', ''),
      nullif(p_logistics ->> 'freight', '')::numeric,
      nullif(p_logistics ->> 'holding', '')::numeric,
      nullif(p_logistics ->> 'point', ''),
      nullif(p_logistics ->> 'others', ''),
      null,
      null,
      null,
      v_user,
      v_user,
      v_user,
      v_now,
      v_now,
      false,
      jsonb_build_object(
        'finishGoodId', v_product_id,
        'type', 'OUT',
        'category', nullif(v_category, ''),
        'quantity', v_quantity,
        'remainingBalance', v_remaining_balance,
        'performedBy', v_user,
        'createdAt', v_now,
        'updatedAt', v_now,
        'createdBy', v_user,
        'updatedBy', v_user,
        'isArchived', false,
        'date', nullif(p_logistics ->> 'date', ''),
        'invoiceNo', nullif(p_logistics ->> 'invoiceNo', ''),
        'place', nullif(p_logistics ->> 'place', ''),
        'transporterName', nullif(p_logistics ->> 'transporterName', ''),
        'vehicleNo', nullif(p_logistics ->> 'vehicleNo', ''),
        'vehicleSize', nullif(p_logistics ->> 'vehicleSize', ''),
        'freight', nullif(p_logistics ->> 'freight', '')::numeric,
        'holding', nullif(p_logistics ->> 'holding', '')::numeric,
        'point', nullif(p_logistics ->> 'point', ''),
        'others', nullif(p_logistics ->> 'others', ''),
        'referenceNo', nullif(p_logistics ->> 'invoiceNo', '')
      ),
      now(),
      now()
    );
  end loop;

  return true;
end;
$$;

create or replace function public.delete_finish_good_transaction(
  p_transaction_id text,
  p_finish_good_id text,
  p_type text,
  p_category text,
  p_quantity numeric,
  p_user text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_user text := coalesce(nullif(btrim(p_user), ''), 'System');
  v_finish_good_id text := nullif(btrim(coalesce(p_finish_good_id, '')), '');
  v_fg public.finish_goods%rowtype;
  v_is_regular boolean := p_category = 'REGULAR' or p_category = 'DISPATCH';
  v_closing_balance numeric;
  v_non_moving_balance numeric;
  v_in_qty numeric;
  v_out_qty numeric;
begin
  if v_finish_good_id is not null then
    select *
      into v_fg
    from public.finish_goods
    where firestore_document_id = v_finish_good_id
    for update;

    if found then
      v_closing_balance := coalesce(v_fg.closing_balance, 0);
      v_non_moving_balance := coalesce(v_fg.non_moving_balance, 0);
      v_in_qty := coalesce(v_fg.in_qty, 0);
      v_out_qty := coalesce(v_fg.out_qty, 0);

      if p_type = 'IN' then
        v_in_qty := v_in_qty - coalesce(p_quantity, 0);
        if v_is_regular then
          v_closing_balance := v_closing_balance - coalesce(p_quantity, 0);
        else
          v_non_moving_balance := v_non_moving_balance - coalesce(p_quantity, 0);
        end if;
      elsif p_type = 'OUT' then
        v_out_qty := v_out_qty - coalesce(p_quantity, 0);
        if v_is_regular then
          v_closing_balance := v_closing_balance + coalesce(p_quantity, 0);
        else
          v_non_moving_balance := v_non_moving_balance + coalesce(p_quantity, 0);
        end if;
      end if;

      update public.finish_goods
      set in_qty = v_in_qty,
          out_qty = v_out_qty,
          closing_balance = v_closing_balance,
          non_moving_balance = v_non_moving_balance,
          updated_at = v_now,
          updated_by = v_user,
          raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object(
            'inQty', v_in_qty,
            'outQty', v_out_qty,
            'closingBalance', v_closing_balance,
            'nonMovingBalance', v_non_moving_balance,
            'updatedAt', v_now,
            'updatedBy', v_user
          )
      where firestore_document_id = v_finish_good_id;
    end if;
  end if;

  delete from public.finish_good_transactions
  where firestore_document_id = p_transaction_id;

  return true;
end;
$$;

create or replace function public.execute_finish_good_inward_transaction(
  p_payloads jsonb,
  p_user text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_user text := coalesce(nullif(btrim(p_user), ''), 'System');
  v_payload jsonb;
  v_alloc jsonb;
  v_product_id text;
  v_quantity numeric;
  v_category text;
  v_rate numeric;
  v_date text;
  v_transaction_id text;
  v_job_card_id text;
  v_alloc_quantity numeric;
  v_loaded_fg_ids text[] := '{}';
  v_loaded_job_card_ids text[] := '{}';
  v_fg_snapshots jsonb := '{}'::jsonb;
  v_job_card_snapshots jsonb := '{}'::jsonb;
  v_fg public.finish_goods%rowtype;
  v_job_card public.job_cards%rowtype;
  v_fg_json jsonb;
  v_job_card_json jsonb;
  v_opening_qty numeric;
  v_in_qty numeric;
  v_out_qty numeric;
  v_closing_balance numeric;
  v_non_moving_balance numeric;
  v_new_opening_qty numeric;
  v_new_in_qty numeric;
  v_new_out_qty numeric;
  v_new_closing_balance numeric;
  v_new_non_moving_balance numeric;
  v_existing_produced numeric;
  v_required_qty numeric;
  v_new_produced numeric;
  v_is_completed boolean;
  v_completion_date text;
begin
  if p_payloads is null or jsonb_typeof(p_payloads) <> 'array' or jsonb_array_length(p_payloads) = 0 then
    raise exception 'At least one finish goods inward row is required';
  end if;

  for v_payload in select value from jsonb_array_elements(p_payloads) loop
    v_product_id := nullif(btrim(coalesce(v_payload ->> 'productId', '')), '');

    if v_product_id is null then
      raise exception 'Finish Good product ID is required';
    end if;

    if not coalesce(v_product_id = any(v_loaded_fg_ids), false) then
      select *
        into v_fg
      from public.finish_goods
      where firestore_document_id = v_product_id
      for update;

      if found then
        v_fg_snapshots := v_fg_snapshots || jsonb_build_object(v_product_id, to_jsonb(v_fg));
      end if;

      v_loaded_fg_ids := array_append(v_loaded_fg_ids, v_product_id);
    end if;

    for v_alloc in select value from jsonb_array_elements(coalesce(v_payload -> 'jobCardAllocations', '[]'::jsonb)) loop
      v_job_card_id := nullif(btrim(coalesce(v_alloc ->> 'jobCardId', '')), '');

      if v_job_card_id is null or coalesce(v_job_card_id = any(v_loaded_job_card_ids), false) then
        continue;
      end if;

      select *
        into v_job_card
      from public.job_cards
      where firestore_document_id = v_job_card_id
      for update;

      if found then
        v_job_card_snapshots := v_job_card_snapshots || jsonb_build_object(v_job_card_id, to_jsonb(v_job_card));
      end if;

      v_loaded_job_card_ids := array_append(v_loaded_job_card_ids, v_job_card_id);
    end loop;
  end loop;

  for v_payload in select value from jsonb_array_elements(p_payloads) loop
    v_product_id := nullif(btrim(coalesce(v_payload ->> 'productId', '')), '');
    v_quantity := coalesce(nullif(v_payload ->> 'quantity', '')::numeric, 0);
    v_category := coalesce(v_payload ->> 'category', '');
    v_rate := coalesce(nullif(v_payload ->> 'rate', '')::numeric, 0);
    v_date := nullif(v_payload ->> 'date', '');
    v_transaction_id := nullif(btrim(coalesce(v_payload ->> 'transactionId', '')), '');

    if v_transaction_id is null then
      raise exception 'Finish Good transaction ID is required';
    end if;

    v_fg_json := v_fg_snapshots -> v_product_id;

    if v_fg_json is null then
      v_new_opening_qty := 0;
      v_new_in_qty := v_quantity;
      v_new_out_qty := 0;
      v_new_closing_balance := 0;
      v_new_non_moving_balance := 0;
    else
      v_opening_qty := coalesce(nullif(v_fg_json ->> 'opening_qty', '')::numeric, 0);
      v_in_qty := coalesce(nullif(v_fg_json ->> 'in_qty', '')::numeric, 0);
      v_out_qty := coalesce(nullif(v_fg_json ->> 'out_qty', '')::numeric, 0);
      v_closing_balance := coalesce(nullif(v_fg_json ->> 'closing_balance', '')::numeric, 0);
      v_non_moving_balance := coalesce(nullif(v_fg_json ->> 'non_moving_balance', '')::numeric, 0);
      v_new_opening_qty := v_opening_qty;
      v_new_in_qty := v_in_qty + v_quantity;
      v_new_out_qty := v_out_qty;
      v_new_closing_balance := v_closing_balance;
      v_new_non_moving_balance := v_non_moving_balance;
    end if;

    if v_category = 'REGULAR' then
      v_new_closing_balance := v_new_closing_balance + v_quantity;
    elsif v_category = 'REJECTED' then
      v_new_non_moving_balance := v_new_non_moving_balance + v_quantity;
    end if;

    insert into public.finish_goods (
      firestore_document_id,
      product_id,
      product_name,
      customer_id,
      customer_name,
      opening_qty,
      in_qty,
      out_qty,
      closing_balance,
      non_moving_balance,
      rate,
      is_archived,
      created_by,
      updated_by,
      created_at,
      updated_at,
      raw_data,
      imported_at,
      synced_at
    ) values (
      v_product_id,
      v_product_id,
      nullif(v_payload ->> 'productName', ''),
      nullif(v_payload ->> 'customerId', ''),
      nullif(v_payload ->> 'customerName', ''),
      v_new_opening_qty,
      v_new_in_qty,
      v_new_out_qty,
      v_new_closing_balance,
      v_new_non_moving_balance,
      v_rate,
      false,
      v_user,
      v_user,
      v_now,
      v_now,
      jsonb_build_object(
        'productId', v_product_id,
        'productName', nullif(v_payload ->> 'productName', ''),
        'customerId', nullif(v_payload ->> 'customerId', ''),
        'customerName', nullif(v_payload ->> 'customerName', ''),
        'openingQty', v_new_opening_qty,
        'inQty', v_new_in_qty,
        'outQty', v_new_out_qty,
        'closingBalance', v_new_closing_balance,
        'nonMovingBalance', v_new_non_moving_balance,
        'rate', v_rate,
        'updatedAt', v_now,
        'updatedBy', v_user,
        'isArchived', false,
        'createdAt', v_now,
        'createdBy', v_user
      ),
      now(),
      now()
    )
    on conflict (firestore_document_id) do update
    set product_id = excluded.product_id,
        product_name = excluded.product_name,
        customer_id = excluded.customer_id,
        customer_name = excluded.customer_name,
        opening_qty = excluded.opening_qty,
        in_qty = excluded.in_qty,
        out_qty = excluded.out_qty,
        closing_balance = excluded.closing_balance,
        non_moving_balance = excluded.non_moving_balance,
        rate = excluded.rate,
        is_archived = false,
        updated_by = v_user,
        updated_at = v_now,
        raw_data = coalesce(public.finish_goods.raw_data, '{}'::jsonb) || jsonb_build_object(
          'productId', v_product_id,
          'productName', nullif(v_payload ->> 'productName', ''),
          'customerId', nullif(v_payload ->> 'customerId', ''),
          'customerName', nullif(v_payload ->> 'customerName', ''),
          'openingQty', excluded.opening_qty,
          'inQty', excluded.in_qty,
          'outQty', excluded.out_qty,
          'closingBalance', excluded.closing_balance,
          'nonMovingBalance', excluded.non_moving_balance,
          'rate', v_rate,
          'updatedAt', v_now,
          'updatedBy', v_user,
          'isArchived', false
        ),
        synced_at = now();

    insert into public.finish_good_transactions (
      firestore_document_id,
      finish_good_id,
      type,
      category,
      quantity,
      remaining_balance,
      rate,
      transaction_date,
      reference_id,
      reference_no,
      invoice_no,
      place,
      transporter_name,
      vehicle_no,
      vehicle_size,
      freight,
      holding,
      point,
      others,
      receiving_status,
      receiving_confirmed_at,
      receiving_confirmed_by,
      performed_by,
      created_by,
      updated_by,
      created_at,
      updated_at,
      is_archived,
      raw_data,
      imported_at,
      synced_at
    ) values (
      v_transaction_id,
      v_product_id,
      'IN',
      nullif(v_category, ''),
      v_quantity,
      case when v_category = 'REGULAR' then v_new_closing_balance else v_new_non_moving_balance end,
      v_rate,
      v_date,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      v_user,
      v_user,
      v_user,
      v_now,
      v_now,
      false,
      jsonb_build_object(
        'finishGoodId', v_product_id,
        'type', 'IN',
        'category', nullif(v_category, ''),
        'quantity', v_quantity,
        'remainingBalance', case when v_category = 'REGULAR' then v_new_closing_balance else v_new_non_moving_balance end,
        'date', v_date,
        'performedBy', v_user,
        'createdAt', v_now,
        'updatedAt', v_now,
        'createdBy', v_user,
        'updatedBy', v_user,
        'isArchived', false
      ),
      now(),
      now()
    );
  end loop;

  for v_payload in select value from jsonb_array_elements(p_payloads) loop
    v_completion_date := nullif(v_payload ->> 'date', '');

    for v_alloc in select value from jsonb_array_elements(coalesce(v_payload -> 'jobCardAllocations', '[]'::jsonb)) loop
      v_job_card_id := nullif(btrim(coalesce(v_alloc ->> 'jobCardId', '')), '');
      v_alloc_quantity := coalesce(nullif(v_alloc ->> 'quantity', '')::numeric, 0);

      if v_job_card_id is null then
        continue;
      end if;

      v_job_card_json := v_job_card_snapshots -> v_job_card_id;
      if v_job_card_json is null then
        continue;
      end if;

      v_existing_produced := coalesce(
        nullif(v_job_card_json ->> 'produced_qty', '')::numeric,
        nullif(v_job_card_json #>> '{raw_data,producedQuantity}', '')::numeric,
        nullif(v_job_card_json #>> '{raw_data,producedQty}', '')::numeric,
        0
      );
      v_required_qty := coalesce(
        nullif(v_job_card_json ->> 'order_qty', '')::numeric,
        nullif(v_job_card_json #>> '{raw_data,quantity}', '')::numeric,
        nullif(v_job_card_json #>> '{raw_data,orderQty}', '')::numeric,
        0
      );
      v_new_produced := v_existing_produced + v_alloc_quantity;
      v_is_completed := v_new_produced >= v_required_qty;

      update public.job_cards
      set produced_qty = v_new_produced,
          status = case when v_is_completed then 'COMPLETED' else status end,
          updated_at = v_now,
          updated_by = v_user,
          raw_data = coalesce(raw_data, '{}'::jsonb)
            || jsonb_build_object(
              'producedQuantity', v_new_produced,
              'updatedAt', v_now,
              'updatedBy', v_user
            )
            || case when v_is_completed then jsonb_build_object('status', 'COMPLETED', 'completionDate', coalesce(v_completion_date, to_char(v_now, 'YYYY-MM-DD'))) else '{}'::jsonb end
      where firestore_document_id = v_job_card_id;
    end loop;
  end loop;

  return true;
end;
$$;

create or replace function public.execute_production_completion_transaction(
  p_job_id text,
  p_new_job_card_payload jsonb,
  p_fg_payload jsonb,
  p_user text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_user text := coalesce(nullif(btrim(p_user), ''), 'System');
  v_job_id text := nullif(btrim(coalesce(p_job_id, '')), '');
  v_job_card public.job_cards%rowtype;
  v_final_state jsonb;
  v_should_freeze boolean;
  v_current_snapshot jsonb;
  v_new_snapshot jsonb;
  v_old_reel_ids text[] := '{}';
  v_new_reel_ids text[] := '{}';
  v_all_reel_ids text[] := '{}';
  v_reel_id text;
  v_reel public.reels%rowtype;
  v_reel_snapshots jsonb := '{}'::jsonb;
  v_reel_json jsonb;
  v_fg public.finish_goods%rowtype;
  v_fg_exists boolean := false;
  v_fg_product_id text;
  v_fg_quantity numeric;
  v_fg_transaction_id text;
  v_fg_new_in_qty numeric;
  v_fg_new_closing_balance numeric;
  v_fg_opening_qty numeric;
  v_fg_out_qty numeric;
  v_fg_non_moving_balance numeric;
  v_reference_no text;
begin
  if v_job_id is null then
    raise exception 'Job Card ID is required';
  end if;

  select *
    into v_job_card
  from public.job_cards
  where firestore_document_id = v_job_id
  for update;

  if not found then
    raise exception 'Job Card not found';
  end if;

  v_final_state := coalesce(v_job_card.raw_data, '{}'::jsonb) || coalesce(p_new_job_card_payload, '{}'::jsonb);
  v_should_freeze := coalesce(v_final_state ->> 'status', '') in ('PENDING', 'PENDING APPROVAL', 'IN_PROCESS');
  v_current_snapshot := coalesce(v_job_card.product_snapshot, coalesce(v_job_card.raw_data, '{}'::jsonb) -> 'productSnapshot', '{}'::jsonb);
  v_new_snapshot := coalesce(v_final_state -> 'productSnapshot', v_current_snapshot, '{}'::jsonb);

  for v_reel_id in
    select distinct nullif(btrim(coalesce(alloc.value ->> 'reelId', '')), '')
    from jsonb_array_elements(coalesce(v_current_snapshot -> 'layers', '[]'::jsonb)) as layer(layer_value)
    cross join lateral jsonb_array_elements(coalesce(layer.layer_value -> 'allocatedReels', '[]'::jsonb)) as alloc(value)
    where nullif(btrim(coalesce(alloc.value ->> 'reelId', '')), '') is not null
  loop
    v_old_reel_ids := array_append(v_old_reel_ids, v_reel_id);
  end loop;

  for v_reel_id in
    select distinct nullif(btrim(coalesce(alloc.value ->> 'reelId', '')), '')
    from jsonb_array_elements(coalesce(v_new_snapshot -> 'layers', '[]'::jsonb)) as layer(layer_value)
    cross join lateral jsonb_array_elements(coalesce(layer.layer_value -> 'allocatedReels', '[]'::jsonb)) as alloc(value)
    where nullif(btrim(coalesce(alloc.value ->> 'reelId', '')), '') is not null
  loop
    v_new_reel_ids := array_append(v_new_reel_ids, v_reel_id);
  end loop;

  v_all_reel_ids := array(
    select distinct reel_id
    from unnest(coalesce(v_old_reel_ids, '{}') || coalesce(v_new_reel_ids, '{}')) as reel_id
    where reel_id is not null
  );

  foreach v_reel_id in array coalesce(v_all_reel_ids, '{}') loop
    select *
      into v_reel
    from public.reels
    where firestore_document_id = v_reel_id
    for update;

    if found then
      v_reel_snapshots := v_reel_snapshots || jsonb_build_object(v_reel_id, to_jsonb(v_reel));
    end if;
  end loop;

  foreach v_reel_id in array coalesce(v_all_reel_ids, '{}') loop
    v_reel_json := v_reel_snapshots -> v_reel_id;
    if v_reel_json is null then
      continue;
    end if;

    if v_should_freeze and coalesce(v_reel_id = any(v_new_reel_ids), false) then
      if coalesce(v_reel_json ->> 'reserved_for_jc', '') <> '' and v_reel_json ->> 'reserved_for_jc' <> v_job_id then
        raise exception 'Reel % is already reserved by another Job Card!', coalesce(v_reel_json #>> '{raw_data,reelNumber}', v_reel_json ->> 'reel_number', v_reel_id);
      end if;

      update public.reels
      set reserved_for_jc = v_job_id,
          active_reserved_weight = 0,
          updated_at = v_now,
          updated_by = v_user,
          raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object(
            'reservedForJC', v_job_id,
            'activeReservedWeight', 0,
            'updatedAt', v_now,
            'updatedBy', v_user
          )
      where firestore_document_id = v_reel_id;
    elsif coalesce(v_reel_id = any(v_old_reel_ids), false) or (not v_should_freeze and coalesce(v_reel_id = any(v_new_reel_ids), false)) then
      if v_reel_json ->> 'reserved_for_jc' = v_job_id then
        update public.reels
        set reserved_for_jc = null,
            active_reserved_weight = 0,
            updated_at = v_now,
            updated_by = v_user,
            raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object(
              'reservedForJC', null,
              'activeReservedWeight', 0,
              'updatedAt', v_now,
              'updatedBy', v_user
            )
        where firestore_document_id = v_reel_id;
      end if;
    end if;
  end loop;

  update public.job_cards
  set product_id_raw = case when p_new_job_card_payload ? 'productId' then nullif(p_new_job_card_payload ->> 'productId', '') else product_id_raw end,
      product_name = case when p_new_job_card_payload ? 'productName' then nullif(p_new_job_card_payload ->> 'productName', '') else product_name end,
      resolved_product_id = case when p_new_job_card_payload ? 'productId' then nullif(p_new_job_card_payload ->> 'productId', '') else resolved_product_id end,
      customer_name = case when p_new_job_card_payload ? 'customerName' then nullif(p_new_job_card_payload ->> 'customerName', '') else customer_name end,
      customer_id_raw = case when p_new_job_card_payload ? 'customerId' then nullif(p_new_job_card_payload ->> 'customerId', '') else customer_id_raw end,
      status = case when p_new_job_card_payload ? 'status' then nullif(p_new_job_card_payload ->> 'status', '') else status end,
      completed_at = case when p_new_job_card_payload ? 'completedAt' then nullif(p_new_job_card_payload ->> 'completedAt', '')::timestamptz else completed_at end,
      completed_by = case when p_new_job_card_payload ? 'completedBy' then nullif(p_new_job_card_payload ->> 'completedBy', '') else completed_by end,
      completion_status = case when p_new_job_card_payload ? 'completionStatus' then nullif(p_new_job_card_payload ->> 'completionStatus', '') else completion_status end,
      produced_qty = case when p_new_job_card_payload ? 'producedQty' then nullif(p_new_job_card_payload ->> 'producedQty', '')::numeric else produced_qty end,
      updated_at = v_now,
      updated_by = v_user,
      raw_data = coalesce(raw_data, '{}'::jsonb)
        || coalesce(p_new_job_card_payload, '{}'::jsonb)
        || jsonb_build_object('updatedAt', v_now, 'updatedBy', v_user)
  where firestore_document_id = v_job_id;

  v_fg_product_id := nullif(btrim(coalesce(p_fg_payload ->> 'productId', '')), '');
  v_fg_quantity := coalesce(nullif(p_fg_payload ->> 'quantity', '')::numeric, 0);
  v_fg_transaction_id := nullif(btrim(coalesce(p_fg_payload ->> 'transactionId', '')), '');
  v_reference_no := coalesce(v_job_card.job_card_no, v_job_card.raw_data ->> 'jobCardNo');

  if v_fg_product_id is null then
    raise exception 'Finish Good product ID is required';
  end if;

  if v_fg_transaction_id is null then
    raise exception 'Finish Good transaction ID is required';
  end if;

  select *
    into v_fg
  from public.finish_goods
  where firestore_document_id = v_fg_product_id
  for update;

  v_fg_exists := found;
  if v_fg_exists then
    v_fg_new_in_qty := coalesce(v_fg.in_qty, 0) + v_fg_quantity;
    v_fg_new_closing_balance := coalesce(v_fg.closing_balance, 0) + v_fg_quantity;
    v_fg_opening_qty := coalesce(v_fg.opening_qty, 0);
    v_fg_out_qty := coalesce(v_fg.out_qty, 0);
    v_fg_non_moving_balance := coalesce(v_fg.non_moving_balance, 0);

    update public.finish_goods
    set product_id = v_fg_product_id,
        product_name = nullif(p_fg_payload ->> 'productName', ''),
        customer_id = nullif(p_fg_payload ->> 'customerId', ''),
        customer_name = nullif(p_fg_payload ->> 'customerName', ''),
        opening_qty = v_fg_opening_qty,
        in_qty = v_fg_new_in_qty,
        out_qty = v_fg_out_qty,
        closing_balance = v_fg_new_closing_balance,
        non_moving_balance = v_fg_non_moving_balance,
        updated_at = v_now,
        updated_by = v_user,
        raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object(
          'productId', v_fg_product_id,
          'productName', nullif(p_fg_payload ->> 'productName', ''),
          'customerId', nullif(p_fg_payload ->> 'customerId', ''),
          'customerName', nullif(p_fg_payload ->> 'customerName', ''),
          'openingQty', v_fg_opening_qty,
          'inQty', v_fg_new_in_qty,
          'outQty', v_fg_out_qty,
          'closingBalance', v_fg_new_closing_balance,
          'nonMovingBalance', v_fg_non_moving_balance,
          'updatedAt', v_now,
          'updatedBy', v_user
        )
    where firestore_document_id = v_fg_product_id;
  else
    v_fg_new_in_qty := v_fg_quantity;
    v_fg_new_closing_balance := v_fg_quantity;
    v_fg_opening_qty := 0;
    v_fg_out_qty := 0;
    v_fg_non_moving_balance := 0;

    insert into public.finish_goods (
      firestore_document_id,
      product_id,
      product_name,
      customer_id,
      customer_name,
      opening_qty,
      in_qty,
      out_qty,
      closing_balance,
      non_moving_balance,
      rate,
      is_archived,
      created_by,
      updated_by,
      created_at,
      updated_at,
      raw_data,
      imported_at,
      synced_at
    ) values (
      v_fg_product_id,
      v_fg_product_id,
      nullif(p_fg_payload ->> 'productName', ''),
      nullif(p_fg_payload ->> 'customerId', ''),
      nullif(p_fg_payload ->> 'customerName', ''),
      v_fg_opening_qty,
      v_fg_new_in_qty,
      v_fg_out_qty,
      v_fg_new_closing_balance,
      v_fg_non_moving_balance,
      null,
      false,
      v_user,
      v_user,
      v_now,
      v_now,
      jsonb_build_object(
        'productId', v_fg_product_id,
        'productName', nullif(p_fg_payload ->> 'productName', ''),
        'customerId', nullif(p_fg_payload ->> 'customerId', ''),
        'customerName', nullif(p_fg_payload ->> 'customerName', ''),
        'openingQty', v_fg_opening_qty,
        'inQty', v_fg_new_in_qty,
        'outQty', v_fg_out_qty,
        'closingBalance', v_fg_new_closing_balance,
        'nonMovingBalance', v_fg_non_moving_balance,
        'updatedAt', v_now,
        'updatedBy', v_user,
        'isArchived', false,
        'createdAt', v_now,
        'createdBy', v_user
      ),
      now(),
      now()
    );
  end if;

  insert into public.finish_good_transactions (
    firestore_document_id,
    finish_good_id,
    type,
    category,
    quantity,
    remaining_balance,
    rate,
    transaction_date,
    reference_id,
    reference_no,
    invoice_no,
    place,
    transporter_name,
    vehicle_no,
    vehicle_size,
    freight,
    holding,
    point,
    others,
    receiving_status,
    receiving_confirmed_at,
    receiving_confirmed_by,
    performed_by,
    created_by,
    updated_by,
    created_at,
    updated_at,
    is_archived,
    raw_data,
    imported_at,
    synced_at
  ) values (
    v_fg_transaction_id,
    v_fg_product_id,
    'IN',
    nullif(p_fg_payload ->> 'category', ''),
    v_fg_quantity,
    null,
    nullif(p_fg_payload ->> 'rate', '')::numeric,
    nullif(p_fg_payload ->> 'date', ''),
    v_job_id,
    v_reference_no,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    v_user,
    null,
    v_now,
    null,
    false,
    jsonb_build_object(
      'finishGoodId', v_fg_product_id,
      'type', 'IN',
      'quantity', v_fg_quantity,
      'date', nullif(p_fg_payload ->> 'date', ''),
      'referenceId', v_job_id,
      'referenceNo', v_reference_no,
      'category', nullif(p_fg_payload ->> 'category', ''),
      'rate', nullif(p_fg_payload ->> 'rate', '')::numeric,
      'isArchived', false,
      'createdAt', v_now,
      'createdBy', v_user
    ),
    now(),
    now()
  );

  return true;
end;
$$;

create or replace function public.mark_finish_good_freight_received(
  p_invoice_no text,
  p_user text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_user text := coalesce(nullif(btrim(p_user), ''), 'System');
  v_count integer := 0;
begin
  update public.finish_good_transactions
  set receiving_status = 'RECEIVED',
      receiving_confirmed_at = v_now,
      receiving_confirmed_by = v_user,
      updated_at = v_now,
      updated_by = v_user,
      raw_data = coalesce(raw_data, '{}'::jsonb) || jsonb_build_object(
        'receivingStatus', 'RECEIVED',
        'receivingConfirmedAt', v_now,
        'receivingConfirmedBy', v_user,
        'updatedAt', v_now,
        'updatedBy', v_user
      )
  where invoice_no = p_invoice_no
    and type = 'OUT';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.execute_finish_good_outward_transaction(jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.delete_finish_good_transaction(text, text, text, text, numeric, text) to anon, authenticated;
grant execute on function public.execute_finish_good_inward_transaction(jsonb, text) to anon, authenticated;
grant execute on function public.execute_production_completion_transaction(text, jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.mark_finish_good_freight_received(text, text) to anon, authenticated;