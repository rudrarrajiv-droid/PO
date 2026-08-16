import { supabase } from './config';
import { logActivity } from './activityLogService';

// Supabase-backed replacement for the Firestore `mr_records` collection.
// Table: public.mr_records (RLS enabled, SELECT + INSERT + UPDATE + DELETE
// granted directly - no RPC needed, these are simple single-row operations
// with no cross-table transactions).
//
// Field mapping (Postgres column -> frontend shape):
//   firestore_document_id -> id
//   material_name          -> materialName
//   opn_stock              -> opnStock
//   opn_amt                -> opnAmt
//   purchase_qty           -> purchaseQty
//   purchase_amt           -> purchaseAmt
//   consumption_qty        -> consumptionQty
//   consumption_amt        -> consumptionAmt
//   closing_qty            -> closingQty
//   closing_amt            -> closingAmt
//   created_by/updated_by  -> createdBy/updatedBy
//   created_at/updated_at  -> createdAt/updatedAt

export interface MRRecord {
  id?: string;
  materialName: string;
  opnStock: number;
  opnAmt: number;
  purchaseQty: number;
  purchaseAmt: number;
  consumptionQty: number;
  consumptionAmt: number;
  closingQty: number;
  closingAmt: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
}

const SELECT_COLUMNS = [
  'firestore_document_id',
  'material_name',
  'opn_stock',
  'opn_amt',
  'purchase_qty',
  'purchase_amt',
  'consumption_qty',
  'consumption_amt',
  'closing_qty',
  'closing_amt',
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

const mapRow = (row: any): MRRecord => ({
  id: row.firestore_document_id,
  materialName: row.material_name ?? '',
  opnStock: toNumber(row.opn_stock),
  opnAmt: toNumber(row.opn_amt),
  purchaseQty: toNumber(row.purchase_qty),
  purchaseAmt: toNumber(row.purchase_amt),
  consumptionQty: toNumber(row.consumption_qty),
  consumptionAmt: toNumber(row.consumption_amt),
  closingQty: toNumber(row.closing_qty),
  closingAmt: toNumber(row.closing_amt),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
});

/**
 * Fetches all MR records, ordered newest-first - mirrors the previous
 * Firestore `query(collection, orderBy('createdAt', 'desc'))` behavior.
 */
export const getMRRecords = async (): Promise<MRRecord[]> => {
  const { data, error } = await supabase
    .from('mr_records')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching MR records:', error);
    throw error;
  }

  return (data || []).map(mapRow);
};

/**
 * Creates a new MR record. Mirrors the previous Firestore `addDoc` behavior:
 * audit fields are populated and the same activity log entry is written.
 * The primary key has no DB default, so a UUID is generated client-side.
 */
export const createMRRecord = async (
  record: Omit<MRRecord, 'id' | 'createdAt' | 'updatedAt'>,
  user: string
): Promise<string> => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const columns = {
    material_name: record.materialName,
    opn_stock: record.opnStock,
    opn_amt: record.opnAmt,
    purchase_qty: record.purchaseQty,
    purchase_amt: record.purchaseAmt,
    consumption_qty: record.consumptionQty,
    consumption_amt: record.consumptionAmt,
    closing_qty: record.closingQty,
    closing_amt: record.closingAmt,
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

  const { error } = await supabase.from('mr_records').insert({ ...row, raw_data: rawData });

  if (error) {
    console.error('Error creating MR record:', error);
    throw error;
  }

  await logActivity({
    user,
    action: `Created MR record for ${record.materialName}`,
    entity: 'mr_records',
    referenceId: id,
  });

  return id;
};

/**
 * Updates an MR record. Mirrors the previous Firestore `updateDoc` behavior:
 * only the fields present on `record` are touched (a true partial update),
 * plus updatedBy/updatedAt, and the same activity log entry is written.
 */
export const updateMRRecord = async (
  id: string,
  record: Partial<Omit<MRRecord, 'id' | 'createdAt' | 'createdBy'>>,
  user: string
): Promise<void> => {
  const now = new Date().toISOString();
  const columns: Record<string, any> = {
    updated_by: user,
    updated_at: now,
  };

  if (record.materialName !== undefined) columns.material_name = record.materialName;
  if (record.opnStock !== undefined) columns.opn_stock = record.opnStock;
  if (record.opnAmt !== undefined) columns.opn_amt = record.opnAmt;
  if (record.purchaseQty !== undefined) columns.purchase_qty = record.purchaseQty;
  if (record.purchaseAmt !== undefined) columns.purchase_amt = record.purchaseAmt;
  if (record.consumptionQty !== undefined) columns.consumption_qty = record.consumptionQty;
  if (record.consumptionAmt !== undefined) columns.consumption_amt = record.consumptionAmt;
  if (record.closingQty !== undefined) columns.closing_qty = record.closingQty;
  if (record.closingAmt !== undefined) columns.closing_amt = record.closingAmt;

  const { error } = await supabase
    .from('mr_records')
    .update(columns)
    .eq('firestore_document_id', id);

  if (error) {
    console.error('Error updating MR record:', error);
    throw error;
  }

  await logActivity({
    user,
    action: `Updated MR record for ${record.materialName || id}`,
    entity: 'mr_records',
    referenceId: id,
  });
};

/**
 * Deletes an MR record. Mirrors the previous Firestore `deleteDoc` behavior
 * (a genuine hard delete - mr_records has no isArchived/soft-delete concept).
 */
export const deleteMRRecord = async (id: string, materialName: string, user: string): Promise<void> => {
  const { error } = await supabase.from('mr_records').delete().eq('firestore_document_id', id);

  if (error) {
    console.error('Error deleting MR record:', error);
    throw error;
  }

  await logActivity({
    user,
    action: `Deleted MR record for ${materialName}`,
    entity: 'mr_records',
    referenceId: id,
  });
};
