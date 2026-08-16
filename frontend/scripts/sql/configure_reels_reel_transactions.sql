create or replace function public.execute_bulk_reel_inward(
  p_rows jsonb,
  p_inward_date text,
  p_supplier_name text,
  p_manufacturer_name text,
  p_user text
) returns boolean
language plpgsql
security invoker
as $$
declare
  v_now timestamptz := now();
  v_user text := coalesce(nullif(btrim(p_user), ''), 'System');
  v_inward_date text := coalesce(nullif(btrim(p_inward_date), ''), v_now::text);
  v_row jsonb;
  v_reel_id text;
  v_transaction_id text;
  v_reel_number text;
  v_weight numeric;
  v_rate numeric;
  v_gsm numeric;
  v_reel_size numeric;
  v_bf text;
  v_paper_type text;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'At least one reel row is required';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_reel_id := nullif(btrim(coalesce(v_row ->> 'reelId', '')), '');
    v_transaction_id := nullif(btrim(coalesce(v_row ->> 'transactionId', '')), '');
    v_reel_number := upper(coalesce(v_row ->> 'reelNumber', ''));
    v_weight := coalesce((v_row ->> 'weight')::numeric, 0);
    v_rate := coalesce((v_row ->> 'rate')::numeric, 0);
    v_gsm := nullif(v_row ->> 'gsm', '')::numeric;
    v_reel_size := nullif(v_row ->> 'reelSize', '')::numeric;
    v_bf := nullif(v_row ->> 'bf', '');
    v_paper_type := nullif(v_row ->> 'paperType', '');

    if v_reel_id is null then
      raise exception 'Reel ID is required';
    end if;

    if v_transaction_id is null then
      raise exception 'Reel transaction ID is required';
    end if;

    if v_reel_number = '' then
      raise exception 'Reel number is required';
    end if;

    if v_weight <= 0 then
      raise exception 'Reel weight must be greater than 0';
    end if;

    insert into public.reels (
      firestore_document_id,
      reel_number,
      paper_type,
      reel_size,
      bf,
      gsm,
      weight,
      current_balance,
      rate,
      supplier_name,
      manufacturer_name,
      inward_date,
      is_archived,
      created_by,
      updated_by,
      created_at,
      updated_at,
      raw_data,
      imported_at,
      synced_at
    ) values (
      v_reel_id,
      v_reel_number,
      v_paper_type,
      v_reel_size,
      v_bf,
      v_gsm,
      v_weight,
      v_weight,
      v_rate,
      nullif(p_supplier_name, ''),
      nullif(p_manufacturer_name, ''),
      v_inward_date::timestamptz,
      false,
      v_user,
      v_user,
      v_now,
      v_now,
      jsonb_build_object(
        'reelNumber', v_reel_number,
        'supplierName', nullif(p_supplier_name, ''),
        'manufacturerName', nullif(p_manufacturer_name, ''),
        'weight', v_weight,
        'currentBalance', v_weight,
        'paperType', v_paper_type,
        'reelSize', v_reel_size,
        'bf', v_bf,
        'gsm', v_gsm,
        'rate', v_rate,
        'inwardDate', v_inward_date,
        'createdAt', v_now,
        'updatedAt', v_now,
        'createdBy', v_user,
        'updatedBy', v_user,
        'isArchived', false
      ),
      now(),
      now()
    );

    insert into public.reel_transactions (
      firestore_document_id,
      reel_id,
      reel_number,
      type,
      quantity,
      remaining_balance,
      job_card_id,
      performed_by,
      notes,
      transaction_date,
      is_archived,
      created_by,
      updated_by,
      created_at,
      updated_at,
      raw_data,
      imported_at,
      synced_at
    ) values (
      v_transaction_id,
      v_reel_id,
      v_reel_number,
      'INWARD',
      v_weight,
      v_weight,
      null,
      v_user,
      null,
      v_inward_date,
      false,
      v_user,
      v_user,
      v_now,
      v_now,
      jsonb_build_object(
        'reelId', v_reel_id,
        'reelNumber', v_reel_number,
        'type', 'INWARD',
        'quantity', v_weight,
        'remainingBalance', v_weight,
        'performedBy', v_user,
        'date', v_inward_date,
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

  return true;
end;
$$;

create or replace function public.execute_reel_outward_transaction(
  p_payloads jsonb,
  p_user text
) returns boolean
language plpgsql
security invoker
as $$
declare
  v_now timestamptz := now();
  v_user text := coalesce(nullif(btrim(p_user), ''), 'System');
  v_payload jsonb;
  v_reel public.reels%rowtype;
  v_reel_id text;
  v_transaction_id text;
  v_reel_number text;
  v_job_card_id text;
  v_consumed_weight numeric;
  v_outward_date text;
  v_new_balance numeric;
begin
  if p_payloads is null or jsonb_typeof(p_payloads) <> 'array' or jsonb_array_length(p_payloads) = 0 then
    raise exception 'At least one outward payload is required';
  end if;

  for v_payload in select value from jsonb_array_elements(p_payloads) loop
    v_reel_id := nullif(btrim(coalesce(v_payload ->> 'reelId', '')), '');
    v_transaction_id := nullif(btrim(coalesce(v_payload ->> 'transactionId', '')), '');
    v_reel_number := coalesce(v_payload ->> 'reelNumber', '');
    v_job_card_id := nullif(btrim(coalesce(v_payload ->> 'jobCardId', '')), '');
    v_consumed_weight := coalesce((v_payload ->> 'consumedWeight')::numeric, 0);
    v_outward_date := coalesce(nullif(btrim(v_payload ->> 'outwardDate'), ''), v_now::text);

    if v_reel_id is null then
      raise exception 'Reel ID is required';
    end if;

    if v_transaction_id is null then
      raise exception 'Transaction ID is required';
    end if;

    if v_consumed_weight <= 0 then
      raise exception 'Consumed weight must be greater than 0';
    end if;

    select *
      into v_reel
    from public.reels
    where firestore_document_id = v_reel_id
    for update;

    if not found then
      raise exception 'Reel % does not exist.', v_reel_number;
    end if;

    if coalesce(v_reel.current_balance, 0) < v_consumed_weight then
      raise exception 'Reel % has insufficient balance. Available: %, Requested: %',
        v_reel_number,
        coalesce(v_reel.current_balance, 0),
        v_consumed_weight;
    end if;
  end loop;

  for v_payload in select value from jsonb_array_elements(p_payloads) loop
    v_reel_id := nullif(btrim(coalesce(v_payload ->> 'reelId', '')), '');
    v_transaction_id := nullif(btrim(coalesce(v_payload ->> 'transactionId', '')), '');
    v_reel_number := coalesce(v_payload ->> 'reelNumber', '');
    v_job_card_id := nullif(btrim(coalesce(v_payload ->> 'jobCardId', '')), '');
    v_consumed_weight := coalesce((v_payload ->> 'consumedWeight')::numeric, 0);
    v_outward_date := coalesce(nullif(btrim(v_payload ->> 'outwardDate'), ''), v_now::text);

    select *
      into v_reel
    from public.reels
    where firestore_document_id = v_reel_id
    for update;

    v_new_balance := coalesce(v_reel.current_balance, 0) - v_consumed_weight;

    update public.reels
    set current_balance = v_new_balance,
        updated_at = v_now,
        updated_by = v_user,
        raw_data = coalesce(v_reel.raw_data, '{}'::jsonb) || jsonb_build_object(
          'currentBalance', v_new_balance,
          'updatedAt', v_now,
          'updatedBy', v_user
        )
    where firestore_document_id = v_reel_id;

    insert into public.reel_transactions (
      firestore_document_id,
      reel_id,
      reel_number,
      type,
      quantity,
      remaining_balance,
      job_card_id,
      performed_by,
      notes,
      transaction_date,
      is_archived,
      created_by,
      updated_by,
      created_at,
      updated_at,
      raw_data,
      imported_at,
      synced_at
    ) values (
      v_transaction_id,
      v_reel_id,
      v_reel_number,
      'OUTWARD',
      v_consumed_weight,
      v_new_balance,
      v_job_card_id,
      v_user,
      null,
      v_outward_date,
      false,
      v_user,
      v_user,
      v_now,
      v_now,
      jsonb_build_object(
        'reelId', v_reel_id,
        'reelNumber', v_reel_number,
        'type', 'OUTWARD',
        'quantity', v_consumed_weight,
        'remainingBalance', v_new_balance,
        'jobCardId', v_job_card_id,
        'performedBy', v_user,
        'date', v_outward_date,
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

  return true;
end;
$$;

create or replace function public.execute_reel_allocation(
  p_job_card_id text,
  p_allocations jsonb,
  p_user text
) returns boolean
language plpgsql
security invoker
as $$
declare
  v_now timestamptz := now();
  v_user text := coalesce(nullif(btrim(p_user), ''), 'System');
  v_job_card public.job_cards%rowtype;
  v_allocation jsonb;
  v_reel public.reels%rowtype;
  v_reel_id text;
  v_transaction_id text;
  v_reel_number text;
  v_allocated_weight numeric;
  v_new_balance numeric;
  v_existing_allocations jsonb := '[]'::jsonb;
  v_added_allocations jsonb := '[]'::jsonb;
begin
  if coalesce(nullif(btrim(p_job_card_id), ''), '') = '' then
    raise exception 'Job Card ID is required';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'At least one reel allocation is required';
  end if;

  select *
    into v_job_card
  from public.job_cards
  where firestore_document_id = p_job_card_id
  for update;

  if not found then
    raise exception 'Job Card does not exist.';
  end if;

  v_existing_allocations := coalesce(v_job_card.raw_data -> 'allocations', '[]'::jsonb);

  for v_allocation in select value from jsonb_array_elements(p_allocations) loop
    v_reel_id := nullif(btrim(coalesce(v_allocation ->> 'reelId', '')), '');
    v_transaction_id := nullif(btrim(coalesce(v_allocation ->> 'transactionId', '')), '');
    v_reel_number := coalesce(v_allocation ->> 'reelNumber', '');
    v_allocated_weight := coalesce((v_allocation ->> 'allocatedWeight')::numeric, 0);

    if v_reel_id is null then
      raise exception 'Reel ID is required';
    end if;

    if v_transaction_id is null then
      raise exception 'Transaction ID is required';
    end if;

    if v_allocated_weight <= 0 then
      raise exception 'Allocated weight must be greater than 0';
    end if;

    select *
      into v_reel
    from public.reels
    where firestore_document_id = v_reel_id
    for update;

    if not found then
      raise exception 'Reel % does not exist.', v_reel_number;
    end if;

    if coalesce(v_reel.current_balance, 0) < v_allocated_weight then
      raise exception 'Reel % has insufficient balance. Available: %, Requested: %',
        v_reel_number,
        coalesce(v_reel.current_balance, 0),
        v_allocated_weight;
    end if;

    v_added_allocations := v_added_allocations || jsonb_build_array(
      v_allocation || jsonb_build_object(
        'allocatedAt', v_now,
        'allocatedBy', v_user
      )
    );
  end loop;

  update public.job_cards
  set updated_at = v_now,
      updated_by = v_user,
      raw_data = coalesce(v_job_card.raw_data, '{}'::jsonb) || jsonb_build_object(
        'allocations', v_existing_allocations || v_added_allocations,
        'updatedAt', v_now,
        'updatedBy', v_user
      )
  where firestore_document_id = p_job_card_id;

  for v_allocation in select value from jsonb_array_elements(p_allocations) loop
    v_reel_id := nullif(btrim(coalesce(v_allocation ->> 'reelId', '')), '');
    v_transaction_id := nullif(btrim(coalesce(v_allocation ->> 'transactionId', '')), '');
    v_reel_number := coalesce(v_allocation ->> 'reelNumber', '');
    v_allocated_weight := coalesce((v_allocation ->> 'allocatedWeight')::numeric, 0);

    select *
      into v_reel
    from public.reels
    where firestore_document_id = v_reel_id
    for update;

    v_new_balance := coalesce(v_reel.current_balance, 0) - v_allocated_weight;

    update public.reels
    set current_balance = v_new_balance,
        updated_at = v_now,
        updated_by = v_user,
        raw_data = coalesce(v_reel.raw_data, '{}'::jsonb) || jsonb_build_object(
          'currentBalance', v_new_balance,
          'updatedAt', v_now,
          'updatedBy', v_user
        )
    where firestore_document_id = v_reel_id;

    insert into public.reel_transactions (
      firestore_document_id,
      reel_id,
      reel_number,
      type,
      quantity,
      remaining_balance,
      job_card_id,
      performed_by,
      notes,
      transaction_date,
      is_archived,
      created_by,
      updated_by,
      created_at,
      updated_at,
      raw_data,
      imported_at,
      synced_at
    ) values (
      v_transaction_id,
      v_reel_id,
      v_reel_number,
      'ALLOCATION',
      v_allocated_weight,
      v_new_balance,
      p_job_card_id,
      v_user,
      null,
      v_now::text,
      false,
      v_user,
      v_user,
      v_now,
      v_now,
      jsonb_build_object(
        'reelId', v_reel_id,
        'reelNumber', v_reel_number,
        'type', 'ALLOCATION',
        'quantity', v_allocated_weight,
        'remainingBalance', v_new_balance,
        'jobCardId', p_job_card_id,
        'performedBy', v_user,
        'date', v_now::text,
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

  return true;
end;
$$;

create or replace function public.delete_reel_transaction(
  p_transaction_id text,
  p_reel_id text,
  p_type text,
  p_quantity numeric,
  p_user text
) returns boolean
language plpgsql
security invoker
as $$
declare
  v_now timestamptz := now();
  v_user text := coalesce(nullif(btrim(p_user), ''), 'System');
  v_reel public.reels%rowtype;
  v_current_balance numeric;
begin
  if coalesce(nullif(btrim(p_reel_id), ''), '') = '' then
    raise exception 'Reel ID is required';
  end if;

  select *
    into v_reel
  from public.reels
  where firestore_document_id = p_reel_id
  for update;

  if not found then
    raise exception 'Reel not found';
  end if;

  v_current_balance := coalesce(v_reel.current_balance, 0);

  if p_type = 'OUTWARD' then
    v_current_balance := v_current_balance + coalesce(p_quantity, 0);
  elsif p_type = 'INWARD' then
    v_current_balance := v_current_balance - coalesce(p_quantity, 0);
  end if;

  update public.reels
  set current_balance = v_current_balance,
      updated_at = v_now,
      updated_by = v_user,
      raw_data = coalesce(v_reel.raw_data, '{}'::jsonb) || jsonb_build_object(
        'currentBalance', v_current_balance,
        'updatedAt', v_now,
        'updatedBy', v_user
      )
  where firestore_document_id = p_reel_id;

  delete from public.reel_transactions
  where firestore_document_id = p_transaction_id;

  return true;
end;
$$;

grant execute on function public.execute_bulk_reel_inward(jsonb, text, text, text, text) to anon, authenticated;
grant execute on function public.execute_reel_outward_transaction(jsonb, text) to anon, authenticated;
grant execute on function public.execute_reel_allocation(text, jsonb, text) to anon, authenticated;
grant execute on function public.delete_reel_transaction(text, text, text, numeric, text) to anon, authenticated;