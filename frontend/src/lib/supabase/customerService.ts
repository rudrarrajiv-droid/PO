import { supabase } from './config';
import { logActivity } from './activityLogService';

// Supabase-backed replacement for the Firestore `customers` collection.
// Table: public.customers (RLS enabled, SELECT + INSERT + UPDATE only).
//
// Field mapping (Postgres column -> frontend shape):
//   firestore_document_id -> id
//   name                  -> name
//   is_archived           -> isArchived
//   created_by            -> createdBy
//   updated_by            -> updatedBy
//   created_at            -> createdAt
//   updated_at            -> updatedAt

export interface SupabaseCustomer {
  id: string;
  name: string;
  isArchived: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const SELECT_COLUMNS = 'firestore_document_id, name, is_archived, created_by, updated_by, created_at, updated_at';

const mapRow = (row: any): SupabaseCustomer => ({
  id: row.firestore_document_id,
  name: row.name,
  isArchived: row.is_archived,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Fetches all non-archived customers, preserving the current app behavior
 * of `queryDocuments('customers', [])` (which always filters isArchived == false).
 */
export const getCustomers = async (): Promise<SupabaseCustomer[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select(SELECT_COLUMNS)
    .eq('is_archived', false);

  if (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }

  return (data || []).map(mapRow);
};

/**
 * Creates a new customer. Mirrors the previous generic `createDocument`
 * behavior: audit fields (createdBy/updatedBy/createdAt/updatedAt/isArchived)
 * are populated, and the same 'Created' activity log entry is written.
 * The primary key (firestore_document_id) has no DB default, so a UUID is
 * generated client-side. `raw_data` is NOT NULL with no default, so it is
 * populated with the same record being written.
 */
export const createCustomer = async (name: string, user: string = 'System'): Promise<string> => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const record = {
    firestore_document_id: id,
    name,
    is_archived: false,
    created_by: user,
    updated_by: user,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from('customers').insert({
    ...record,
    raw_data: record,
  });

  if (error) {
    console.error('Error creating customer:', error);
    throw error;
  }

  await logActivity({
    user,
    action: 'Created',
    entity: 'customers',
    referenceId: id,
  });

  return id;
};

/**
 * Updates a customer's name. Mirrors the previous generic `updateDocument`
 * behavior: only updatedBy/updatedAt are touched alongside the changed
 * field(s), and the same 'Updated' activity log entry is written.
 */
export const updateCustomer = async (id: string, name: string, user: string = 'System'): Promise<void> => {
  const { error } = await supabase
    .from('customers')
    .update({
      name,
      updated_by: user,
      updated_at: new Date().toISOString(),
    })
    .eq('firestore_document_id', id);

  if (error) {
    console.error('Error updating customer:', error);
    throw error;
  }

  await logActivity({
    user,
    action: 'Updated',
    entity: 'customers',
    referenceId: id,
  });
};
