import { supabase } from './config';
import { logActivity } from './activityLogService';
import type { Employee } from '../firebase/salaryServices';

// Supabase-backed replacement for the Firestore `employees` collection.
// Table: public.employees (RLS enabled, SELECT + INSERT + UPDATE only).
// Attendance stays on Firestore (lib/firebase/salaryServices.ts) - not touched here.
//
// Field mapping (Postgres column -> Employee shape):
//   firestore_document_id -> id
//   employee_code          -> employeeCode
//   name                   -> name
//   category               -> category
//   contractor_name        -> contractorName
//   designation            -> designation
//   basic_salary           -> basicSalary
//   is_active              -> isActive
//   created_by / updated_by -> createdBy / updatedBy
//   created_at / updated_at -> createdAt / updatedAt

const SELECT_COLUMNS =
  'firestore_document_id, employee_code, name, category, contractor_name, designation, basic_salary, is_active, created_by, updated_by, created_at, updated_at';

const mapRow = (row: any): Employee => ({
  id: row.firestore_document_id,
  employeeCode: row.employee_code ?? undefined,
  name: row.name,
  category: row.category,
  contractorName: row.contractor_name ?? undefined,
  designation: row.designation,
  basicSalary: row.basic_salary,
  isActive: row.is_active,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Fetches active employees, sorted by employeeCode ascending with NULL
 * codes last - matching the previous Firestore `getEmployees()` behavior
 * (which sorted client-side using `employeeCode ?? 99999`).
 */
export const getEmployees = async (): Promise<Employee[]> => {
  const { data, error } = await supabase
    .from('employees')
    .select(SELECT_COLUMNS)
    .eq('is_active', true)
    .order('employee_code', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }

  return (data || []).map(mapRow);
};

/**
 * Creates a new employee. Mirrors the previous Firestore `createEmployee`
 * behavior: same fields persisted, audit fields populated, and the same
 * 'Added Employee: <name>' activity log entry is written. The primary key
 * (firestore_document_id) has no DB default, so a UUID is generated
 * client-side. `raw_data` is NOT NULL with no default, so it is populated
 * with the same record being written.
 */
export const createEmployee = async (employee: Omit<Employee, 'id'>, user: string): Promise<string> => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const record = {
    firestore_document_id: id,
    employee_code: employee.employeeCode ?? null,
    name: employee.name,
    category: employee.category,
    contractor_name: employee.contractorName ?? null,
    designation: employee.designation,
    basic_salary: employee.basicSalary,
    is_active: true,
    created_by: user,
    updated_by: user,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from('employees').insert({
    ...record,
    raw_data: record,
  });

  if (error) {
    console.error('Error creating employee:', error);
    throw error;
  }

  await logActivity({
    user,
    action: `Added Employee: ${employee.name}`,
    entity: 'employees',
    referenceId: id,
  });

  return id;
};

/**
 * Updates an employee. Mirrors the previous Firestore `updateEmployee`
 * behavior: only the fields the current app ever sends (employeeCode,
 * name, designation, basicSalary) are updated, alongside updatedBy/updatedAt.
 */
export const updateEmployee = async (employeeId: string, updates: Partial<Employee>, user: string): Promise<void> => {
  const patch: Record<string, unknown> = {
    updated_by: user,
    updated_at: new Date().toISOString(),
  };
  if (updates.employeeCode !== undefined) patch.employee_code = updates.employeeCode ?? null;
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.designation !== undefined) patch.designation = updates.designation;
  if (updates.basicSalary !== undefined) patch.basic_salary = updates.basicSalary;

  const { error } = await supabase
    .from('employees')
    .update(patch)
    .eq('firestore_document_id', employeeId);

  if (error) {
    console.error('Error updating employee:', error);
    throw error;
  }

  await logActivity({
    user,
    action: `Updated Employee`,
    entity: 'employees',
    referenceId: employeeId,
  });
};

/**
 * Soft-deletes an employee: sets is_active = false only, matching the
 * previous Firestore `deleteEmployee` behavior exactly (never a hard delete).
 */
export const deleteEmployee = async (employeeId: string, user: string): Promise<void> => {
  const { error } = await supabase
    .from('employees')
    .update({
      is_active: false,
      updated_by: user,
      updated_at: new Date().toISOString(),
    })
    .eq('firestore_document_id', employeeId);

  if (error) {
    console.error('Error deleting employee:', error);
    throw error;
  }

  await logActivity({
    user,
    action: `Deleted Employee`,
    entity: 'employees',
    referenceId: employeeId,
  });
};
