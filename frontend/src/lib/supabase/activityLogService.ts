import { supabase } from './config';

// Supabase-backed replacement for the Firestore `activityLogs` collection.
// Table: public.activity_logs (RLS enabled, SELECT + INSERT only for anon/authenticated).
//
// Field mapping (Firestore shape -> Postgres column):
//   user       -> app_user
//   action     -> action
//   entity     -> entity
//   referenceId -> reference_id
//   count      -> count
//   details    -> details
//   timestamp  -> logged_at (set client-side at insert time; no serverTimestamp() equivalent needed here)
//
// `firestore_document_id` (the primary key) is left unset on new rows - the
// column has a DB-generated UUID default, so historical migrated rows keep
// their original Firestore document IDs while new rows get a fresh UUID.

export interface ActivityLogEntry {
  user?: string;
  action?: string;
  entity?: string;
  referenceId?: string;
  count?: number;
  details?: string;
  // Accepted for call-site compatibility with existing Firestore callers
  // (which always pass serverTimestamp()); intentionally ignored, since
  // logged_at is always stamped at insert time below.
  timestamp?: unknown;
}

export interface ActivityLogRecord {
  id: string;
  user: string | null;
  action: string | null;
  entity: string | null;
  referenceId: string | null;
  count: number | null;
  details: string | null;
  timestamp: string | null;
}

/**
 * Logs an activity entry. Mirrors the previous Firestore `logActivity`
 * behavior: failures are caught and logged to the console but never thrown,
 * so a logging failure can never break the calling business operation.
 */
export const logActivity = async (activity: ActivityLogEntry): Promise<void> => {
  try {
    // Historically (see migrate_activity_logs_adc_to_supabase.ts), raw_data
    // stored the complete original record for that log entry - it is
    // NOT NULL with no default. For new rows we mirror that: raw_data is
    // the same normalized record we write to the typed columns below
    // (rather than the caller's raw `activity` argument, which may still
    // carry a legacy Firestore `serverTimestamp()` sentinel that isn't a
    // plain JSON-serializable value).
    const normalized = {
      app_user: activity.user ?? null,
      action: activity.action ?? null,
      entity: activity.entity ?? null,
      reference_id: activity.referenceId ?? null,
      count: activity.count ?? null,
      details: activity.details ?? null,
      logged_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('activity_logs').insert({
      ...normalized,
      raw_data: normalized,
    });
    if (error) throw error;
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Fetches the most recent activity logs, newest first. Replaces the
 * previous Firestore fetch-all-then-sort-in-JS pattern with a proper
 * ORDER BY + LIMIT at the database.
 */
export const getRecentActivityLogs = async (limit: number = 50): Promise<ActivityLogRecord[]> => {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('firestore_document_id, app_user, action, entity, reference_id, count, details, logged_at')
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activity logs:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.firestore_document_id,
    user: row.app_user,
    action: row.action,
    entity: row.entity,
    referenceId: row.reference_id,
    count: row.count,
    details: row.details,
    timestamp: row.logged_at,
  }));
};
