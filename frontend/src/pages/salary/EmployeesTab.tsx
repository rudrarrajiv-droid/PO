import React, { useState, useEffect } from 'react';
import { Plus, Users, Building2, HardHat, Upload, Loader2, Trash2, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import { getEmployees, createEmployee, deleteEmployee, updateEmployee } from '../../lib/supabase/employeeService';
import type { Employee } from '../../lib/firebase/salaryServices';

export default function EmployeesTab() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'COMPANY' | 'WAGES_DINESH' | 'WAGES_VIKAS'>('ALL');
  const [isImporting, setIsImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  // Edit form fields
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editBasicSalary, setEditBasicSalary] = useState('');

  // Form state
  const [employeeCode, setEmployeeCode] = useState('');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [category, setCategory] = useState<'COMPANY' | 'WAGES'>('COMPANY');
  const [contractorName, setContractorName] = useState<'Dinesh' | 'Vikas'>('Dinesh');
  const [basicSalary, setBasicSalary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !designation || !basicSalary) return;

    try {
      setIsSubmitting(true);
      const employeeData: any = {
        employeeCode: employeeCode ? Number(employeeCode) : undefined,
        name,
        designation,
        category,
        basicSalary: Number(basicSalary),
        isActive: true
      };
      
      if (category === 'WAGES') {
        employeeData.contractorName = contractorName;
      }

      await createEmployee(employeeData, user?.name || 'System');
      
      setShowAddModal(false);
      setEmployeeCode('');
      setName('');
      setDesignation('');
      setCategory('COMPANY');
      setBasicSalary('');
      fetchEmployees();
    } catch (error: any) {
      console.error(error);
      alert('Failed to add employee: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Are you sure you want to remove "${emp.name}" from the active list?`)) return;
    try {
      setDeletingId(emp.id!);
      await deleteEmployee(emp.id!, user?.name || 'System');
      fetchEmployees();
    } catch (error: any) {
      alert('Failed to delete: ' + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setEditCode(emp.employeeCode?.toString() || '');
    setEditName(emp.name);
    setEditDesignation(emp.designation);
    setEditBasicSalary(emp.basicSalary?.toString() || '');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    try {
      setIsUpdating(true);
      await updateEmployee(editingEmp.id!, {
        employeeCode: editCode ? Number(editCode) : undefined,
        name: editName,
        designation: editDesignation,
        basicSalary: Number(editBasicSalary),
      }, user?.name || 'System');
      setEditingEmp(null);
      fetchEmployees();
    } catch (error: any) {
      alert('Failed to update: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      for (const row of jsonData) {
        if (!row.Name || !row.Designation || !row.BasicSalary) continue;
        
        let rowCat: 'COMPANY' | 'WAGES' = 'COMPANY';
        let rowCont: 'Dinesh' | 'Vikas' | undefined = undefined;

        if (String(row.Category).toUpperCase().includes('WAGE') || String(row.Category).toUpperCase() === 'CONTRACTOR') {
          rowCat = 'WAGES';
          const cName = String(row.ContractorName || '').toLowerCase();
          if (cName.includes('vikas')) rowCont = 'Vikas';
          else rowCont = 'Dinesh';
        }

        await createEmployee({
          employeeCode: row.EmployeeCode ? Number(row.EmployeeCode) : undefined,
          name: String(row.Name),
          designation: String(row.Designation),
          category: rowCat,
          contractorName: rowCont,
          basicSalary: Number(row.BasicSalary) || 0,
          isActive: true
        }, user?.name || 'System');
      }

      fetchEmployees();
      alert('Import successful!');
    } catch (error) {
      console.error(error);
      alert('Failed to import data. Check console for details.');
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const filteredEmployees = employees.filter(emp => {
    if (filter === 'ALL') return true;
    if (filter === 'COMPANY') return emp.category === 'COMPANY';
    if (filter === 'WAGES_DINESH') return emp.category === 'WAGES' && emp.contractorName === 'Dinesh';
    if (filter === 'WAGES_VIKAS') return emp.category === 'WAGES' && emp.contractorName === 'Vikas';
    return true;
  });

  const thClass = "px-3 py-3 border-b border-border text-left font-medium text-muted-foreground whitespace-nowrap";

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border border-border shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Employee Directory</h2>
          <p className="text-sm text-muted-foreground">Manage active company and wages workforce</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center px-4 py-2 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-secondary/80 transition-colors shadow-sm cursor-pointer disabled:opacity-50">
            {isImporting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Upload className="w-5 h-5 mr-2" />}
            Import Excel
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} disabled={isImporting} />
          </label>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Employee
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        {(['ALL', 'COMPANY', 'WAGES_DINESH', 'WAGES_VIKAS'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
              filter === f 
                ? 'bg-primary text-primary-foreground border-primary' 
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'COMPANY' ? 'Company' : f === 'WAGES_DINESH' ? 'Wages (Dinesh)' : 'Wages (Vikas)'}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className={thClass}>Code</th>
                <th className={thClass}>Category</th>
                <th className={thClass}>Employee Name</th>
                <th className={thClass}>Designation</th>
                <th className={thClass}>Basic Salary</th>
                <th className={thClass}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">Loading employees...</td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    No employees found for this filter.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-muted/50 transition-colors border-b border-border">
                    <td className="px-3 py-3 font-bold text-primary">
                      {emp.employeeCode ?? '-'}
                    </td>
                    <td className="px-3 py-3">
                      {emp.category === 'COMPANY' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          <Building2 className="w-3 h-3 mr-1" />
                          Company
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                          <HardHat className="w-3 h-3 mr-1" />
                          Wages {emp.contractorName ? `(${emp.contractorName})` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">{emp.name}</td>
                    <td className="px-3 py-3">{emp.designation}</td>
                    <td className="px-3 py-3 font-medium">₹ {emp.basicSalary.toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(emp)}
                          className="flex items-center px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          disabled={deletingId === emp.id}
                          className="flex items-center px-2 py-1 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-md transition-colors disabled:opacity-50"
                        >
                          {deletingId === emp.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">Add New Employee</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <form onSubmit={handleAddEmployee} className="p-4 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Employee Code (Number)</label>
                  <input 
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    placeholder="e.g. 1, 2, 3..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">Employees will be sorted in ascending order of this code</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                  <select 
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                  >
                    <option value="COMPANY">Company Employee</option>
                    <option value="WAGES">Wages Labour</option>
                  </select>
                </div>
                {category === 'WAGES' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Contractor Name *</label>
                    <select 
                      className="w-full px-3 py-2 border border-input bg-background rounded-md"
                      value={contractorName}
                      onChange={(e) => setContractorName(e.target.value as any)}
                    >
                      <option value="Dinesh">Dinesh</option>
                      <option value="Vikas">Vikas</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Employee Name *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Designation *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Basic Monthly Salary (₹) *</label>
                  <input 
                    type="number" 
                    required 
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-input rounded-md"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Edit Employee</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Update employee code and details</p>
              </div>
              <button onClick={() => setEditingEmp(null)} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
            </div>
            
            <form onSubmit={handleUpdate} className="p-4">
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800 font-medium">
                    ✏️ Editing: <span className="font-bold">{editingEmp.name}</span>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Employee Code (Number)</label>
                  <input 
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-lg font-bold"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    placeholder="e.g. 1, 2, 3..."
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1">Employees will sort by this code in ascending order</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Employee Name *</label>
                  <input 
                    type="text" required
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Designation *</label>
                  <input 
                    type="text" required
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Basic Monthly Salary (₹) *</label>
                  <input 
                    type="number" required min="0" step="0.01"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    value={editBasicSalary}
                    onChange={(e) => setEditBasicSalary(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingEmp(null)} className="px-4 py-2 border border-input rounded-md" disabled={isUpdating}>
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 flex items-center" disabled={isUpdating}>
                  {isUpdating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

  );
}
