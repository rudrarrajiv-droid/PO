import { supabase } from './config';
import { logActivity } from './activityLogService';

// Supabase-backed replacement for the Firestore `rm_records` collection.
// Table: public.rm_records (RLS enabled, SELECT + INSERT + UPDATE + DELETE
// granted directly - no RPC needed, these are simple single-row operations
// with no cross-table transactions).
//
// Field mapping (Postgres column -> frontend shape):
//   firestore_document_id -> id
//   rm_name                -> rmName
//   opn                    -> opn
//   rate                   -> rate
//   total_in               -> totalIn
//   total_out              -> totalOut
//   cl_bal                 -> clBal
//   opn_stock_value        -> opnStockValue
//   purchase_value_stock   -> purchaseValueStock
//   consumption_stock      -> consumptionStock
//   closing_stock_value    -> closingStockValue
//   day_wise               -> dayWise
//   created_by/updated_by  -> createdBy/updatedBy
//   created_at/updated_at  -> createdAt/updatedAt

export interface RMRecord {
  id?: string;
  rmName: string;
  opn: number;
  rate: number;
  totalIn: number;
  totalOut: number;
  clBal: number;
  opnStockValue: number;
  purchaseValueStock: number;
  consumptionStock: number;
  closingStockValue: number;
  // dayWise is an object mapping day number (1-31) to { in: number, out: number }
  dayWise: Record<string, { in: number, out: number }>;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
}

const SELECT_COLUMNS = [
  'firestore_document_id',
  'rm_name',
  'opn',
  'rate',
  'total_in',
  'total_out',
  'cl_bal',
  'opn_stock_value',
  'purchase_value_stock',
  'consumption_stock',
  'closing_stock_value',
  'day_wise',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
].join(', ');

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

const mapRow = (row: any): RMRecord => ({
  id: row.firestore_document_id,
  rmName: row.rm_name ?? '',
  opn: toNumber(row.opn),
  rate: toNumber(row.rate),
  totalIn: toNumber(row.total_in),
  totalOut: toNumber(row.total_out),
  clBal: toNumber(row.cl_bal),
  opnStockValue: toNumber(row.opn_stock_value),
  purchaseValueStock: toNumber(row.purchase_value_stock),
  consumptionStock: toNumber(row.consumption_stock),
  closingStockValue: toNumber(row.closing_stock_value),
  dayWise: row.day_wise ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
});

/**
 * Fetches all RM records, ordered newest-first - mirrors the previous
 * Firestore `query(collection, orderBy('createdAt', 'desc'))` behavior.
 */
export const getRMRecords = async (): Promise<RMRecord[]> => {
  const { data, error } = await supabase
    .from('rm_records')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching RM records:', error);
    throw error;
  }

  return (data || []).map(mapRow);
};

/**
 * Creates a new RM record. Mirrors the previous Firestore `addDoc` behavior:
 * audit fields are populated and the same activity log entry is written.
 * The primary key has no DB default, so a UUID is generated client-side.
 */
export const createRMRecord = async (
  record: Omit<RMRecord, 'id' | 'createdAt' | 'updatedAt'>,
  user: string
): Promise<string> => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const columns = {
    rm_name: record.rmName,
    opn: record.opn,
    rate: record.rate,
    total_in: record.totalIn,
    total_out: record.totalOut,
    cl_bal: record.clBal,
    opn_stock_value: record.opnStockValue,
    purchase_value_stock: record.purchaseValueStock,
    consumption_stock: record.consumptionStock,
    closing_stock_value: record.closingStockValue,
    day_wise: record.dayWise ?? {},
  };

  const row = {
    firestore_document_id: id,
    ...columns,
    created_by: user,
    updated_by: user,
    created_at: now,
    updated_at: now,
  };

  const rawData = { ...record, id, createdBy: user, updatedBy: user, createdAt: now, updatedAt: now };

  const { error } = await supabase.from('rm_records').insert({ ...row, raw_data: rawData });

  if (error) {
    console.error('Error creating RM record:', error);
    throw error;
  }

  await logActivity({
    user,
    action: `Created RM record for ${record.rmName}`,
    entity: 'rm_records',
    referenceId: id,
  });

  return id;
};

/**
 * Updates an RM record. Mirrors the previous Firestore `updateDoc` behavior:
 * only the fields present on `record` are touched (a true partial update),
 * plus updatedBy/updatedAt, and the same activity log entry is written.
 */
export const updateRMRecord = async (
  id: string,
  record: Partial<Omit<RMRecord, 'id' | 'createdAt' | 'createdBy'>>,
  user: string
): Promise<void> => {
  const now = new Date().toISOString();
  const columns: Record<string, any> = {
    updated_by: user,
    updated_at: now,
  };

  if (record.rmName !== undefined) columns.rm_name = record.rmName;
  if (record.opn !== undefined) columns.opn = record.opn;
  if (record.rate !== undefined) columns.rate = record.rate;
  if (record.totalIn !== undefined) columns.total_in = record.totalIn;
  if (record.totalOut !== undefined) columns.total_out = record.totalOut;
  if (record.clBal !== undefined) columns.cl_bal = record.clBal;
  if (record.opnStockValue !== undefined) columns.opn_stock_value = record.opnStockValue;
  if (record.purchaseValueStock !== undefined) columns.purchase_value_stock = record.purchaseValueStock;
  if (record.consumptionStock !== undefined) columns.consumption_stock = record.consumptionStock;
  if (record.closingStockValue !== undefined) columns.closing_stock_value = record.closingStockValue;
  if (record.dayWise !== undefined) columns.day_wise = record.dayWise;

  const { error } = await supabase
    .from('rm_records')
    .update(columns)
    .eq('firestore_document_id', id);

  if (error) {
    console.error('Error updating RM record:', error);
    throw error;
  }

  await logActivity({
    user,
    action: `Updated RM record for ${record.rmName || id}`,
    entity: 'rm_records',
    referenceId: id,
  });
};

/**
 * Deletes an RM record. Mirrors the previous Firestore `deleteDoc` behavior
 * (a genuine hard delete - rm_records has no isArchived/soft-delete concept).
 */
export const deleteRMRecord = async (id: string, rmName: string, user: string): Promise<void> => {
  const { error } = await supabase.from('rm_records').delete().eq('firestore_document_id', id);

  if (error) {
    console.error('Error deleting RM record:', error);
    throw error;
  }

  await logActivity({
    user,
    action: `Deleted RM record for ${rmName}`,
    entity: 'rm_records',
    referenceId: id,
  });
};
