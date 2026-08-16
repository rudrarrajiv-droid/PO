import { supabase } from './config';
import { logActivity } from './activityLogService';

// Supabase-backed replacement for the Firestore `dc_records` collection.
// Table: public.dc_records (RLS enabled, SELECT + INSERT + UPDATE only).
// reels/reelTransactions are handled by lib/supabase/reelService.ts - not touched here.
//
// Field mapping (Postgres column -> DCRecord shape):
//   record_date -> date
//   total_ply   -> totalPly
//   scrap       -> scrap
//
// `firestore_document_id` is kept as the deterministic key = the date
// string itself, exactly matching the previous Firestore convention
// (doc(db, 'dc_records', record.date)).

export interface DCRecord {
  date: string; // YYYY-MM-DD
  totalPly: number;
  scrap: number;
}

const mapRow = (row: any): DCRecord => ({
  date: row.record_date,
  totalPly: row.total_ply,
  scrap: row.scrap,
});

/**
 * Fetches DC records for a given "YYYY-MM" month prefix, keyed by date -
 * matching the previous Firestore `getDCRecordsByMonth` return shape.
 * Uses a native date-range query instead of fetch-all-then-filter-by-prefix.
 */
export const getDCRecordsByMonth = async (monthPrefix: string): Promise<Record<string, DCRecord>> => {
  const startStr = `${monthPrefix}-01`;
  const [yearStr, monthStr] = monthPrefix.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStr = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('dc_records')
    .select('record_date, total_ply, scrap')
    .gte('record_date', startStr)
    .lt('record_date', nextMonthStr);

  if (error) {
    console.error('Error fetching DC records:', error);
    throw error;
  }

  const map: Record<string, DCRecord> = {};
  (data || []).forEach(row => {
    const rec = mapRow(row);
    map[rec.date] = rec;
  });
  return map;
};

/**
 * Upserts a DC record for a given date, using the date string itself as
 * the deterministic `firestore_document_id` key - exactly matching the
 * previous Firestore `setDoc(doc(db,'dc_records', record.date), ..., {merge:true})`
 * behavior. `raw_data` is NOT NULL with no default, so it is populated
 * with the same record being written.
 */
export const saveDCRecord = async (record: DCRecord, user: string): Promise<void> => {
  const row = {
    firestore_document_id: record.date,
    record_date: record.date,
    total_ply: record.totalPly,
    scrap: record.scrap,
  };

  // .select() forces PostgREST to return the affected row (instead of the
  // default empty body) so we can confirm the write actually persisted,
  // rather than trusting the HTTP status code alone (upsert responses can
  // report success even when nothing meaningful was returned/verified).
  const { data, error } = await supabase
    .from('dc_records')
    .upsert({ ...row, raw_data: row }, { onConflict: 'firestore_document_id' })
    .select('firestore_document_id, record_date, total_ply, scrap');

  if (error) {
    console.error('Error saving DC record:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    const notPersistedError = new Error(`DC record for ${record.date} was not persisted (no row returned after upsert).`);
    console.error(notPersistedError.message);
    throw notPersistedError;
  }

  await logActivity({
    user,
    action: `Updated DC Record for ${record.date}`,
    entity: 'dc_records',
    referenceId: record.date,
  });
};
