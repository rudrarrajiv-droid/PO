import React, { useState, useEffect } from 'react';
import { Archive, Search, Plus, Edit2, Trash2, Loader2, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getRMRecords, createRMRecord, updateRMRecord, deleteRMRecord, type RMRecord } from '../lib/supabase/rmService';

export default function RM() {
  const { user } = useAuth();
  const [records, setRecords] = useState<RMRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [currentRecord, setCurrentRecord] = useState<Partial<RMRecord>>({});
  const [recordToDelete, setRecordToDelete] = useState<RMRecord | null>(null);

  // Phase 28: Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  const thClass = "px-3 py-3 border-b border-border text-left font-medium text-muted-foreground whitespace-nowrap";
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const data = await getRMRecords();
      setRecords(data);
    } catch (error) {
      console.error(error);
      showMessage('error', 'Failed to load RM records.');
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleOpenAdd = () => {
    setCurrentRecord({
      rmName: '',
      opn: 0,
      rate: 0,
      totalIn: 0,
      totalOut: 0,
      clBal: 0,
      opnStockValue: 0,
      purchaseValueStock: 0,
      consumptionStock: 0,
      closingStockValue: 0,
      dayWise: {}
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (record: RMRecord) => {
    setCurrentRecord({ ...record });
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRecord.rmName) return;

    // Phase 25: Duplicate Protection (Case-insensitive)
    if (!currentRecord.id) {
      const isDuplicate = records.some(
        (r) => r.rmName.toLowerCase() === currentRecord.rmName?.toLowerCase()
      );
      if (isDuplicate) {
        showMessage('error', 'RM record with this Name already exists.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const recordToSave = {
        ...currentRecord,
        dayWise: currentRecord.dayWise || {}
      };

      if (currentRecord.id) {
        await updateRMRecord(currentRecord.id, recordToSave, user?.name || 'System');
        showMessage('success', 'RM updated successfully.');
      } else {
        await createRMRecord(recordToSave as any, user?.name || 'System');
        showMessage('success', 'RM created successfully.');
      }
      setShowAddModal(false);
      fetchRecords();
    } catch (error) {
      showMessage('error', 'Failed to save RM record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!recordToDelete || !recordToDelete.id) return;
    setIsSubmitting(true);
    try {
      await deleteRMRecord(recordToDelete.id, recordToDelete.rmName, user?.name || 'System');
      showMessage('success', 'RM deleted successfully.');
      setShowDeleteModal(false);
      setRecordToDelete(null);
      fetchRecords();
    } catch (error) {
      showMessage('error', 'Failed to delete record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof RMRecord, value: any) => {
    setCurrentRecord(prev => {
      const next = { ...prev, [field]: value };
      
      // Phase 25: Auto-calculations
      const opn = Number(next.opn) || 0;
      const rate = Number(next.rate) || 0;
      
      // Calculate Total In/Out from dayWise if we had UI for it. 
      // Since DayWise UI is currently in table/readonly, if we update Total In manually we shouldn't overwrite it, 
      // BUT the instructions say "Total In = Sum of Days 1-31 (In)". 
      // We will ensure that if dayWise exists, it drives Total In/Out. 
      // If it's a new record or they manually edit TotalIn/Out in the modal, we'll let it be for now 
      // UNLESS we strictly enforce the formula. The formula says it depends on DayWise.
      let totalIn = 0;
      let totalOut = 0;
      
      if (next.dayWise && Object.keys(next.dayWise).length > 0) {
        totalIn = Object.values(next.dayWise).reduce((sum, day) => sum + (day.in || 0), 0);
        totalOut = Object.values(next.dayWise).reduce((sum, day) => sum + (day.out || 0), 0);
      } else {
        // Fallback to manual entry if dayWise is empty
        totalIn = Number(next.totalIn) || 0;
        totalOut = Number(next.totalOut) || 0;
      }
      
      next.totalIn = totalIn;
      next.totalOut = totalOut;
      
      const clBal = opn + totalIn - totalOut;
      next.clBal = clBal;
      
      next.opnStockValue = opn * rate;
      next.purchaseValueStock = totalIn * rate;
      next.consumptionStock = totalOut * rate;
      next.closingStockValue = clBal * rate;

      return next;
    });
  };

  const filteredRecords = records.filter(record => 
    record.rmName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const summaryTotals = filteredRecords.reduce((acc, curr) => ({
    totalClBal: acc.totalClBal + (Number(curr.clBal) || 0),
    totalStockValue: acc.totalStockValue + (Number(curr.closingStockValue) || 0)
  }), { totalClBal: 0, totalStockValue: 0 });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">RM (Raw Material) Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track raw material day-book</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by RM Name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 w-64 text-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title="Clear Filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Record
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border/50 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total RM Items</h3>
          <p className="text-3xl font-bold text-foreground">{filteredRecords.length}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border/50 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Closing Balance</h3>
          <p className="text-3xl font-bold text-blue-600">{summaryTotals.totalClBal.toFixed(2)}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border/50 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Closing Value</h3>
          <p className="text-3xl font-bold text-emerald-600">₹ {summaryTotals.totalStockValue.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className={thClass} rowSpan={2}>Sr No.</th>
                <th className={thClass} rowSpan={2}>Raw Material</th>
                <th className={thClass} rowSpan={2}>Opn</th>
                <th className={thClass} rowSpan={2}>In</th>
                <th className={thClass} rowSpan={2}>Out</th>
                <th className={thClass} rowSpan={2}>Cl Bal</th>
                <th className={thClass} rowSpan={2}>Rate</th>
                {days.map(day => (
                  <th key={day} className={thClass} colSpan={2} style={{ textAlign: 'center' }}>Day {day}</th>
                ))}
                <th className={thClass} rowSpan={2}>Opn Stock Value</th>
                <th className={thClass} rowSpan={2}>Purchase Value Stock</th>
                <th className={thClass} rowSpan={2}>Consumption Stock</th>
                <th className={thClass} rowSpan={2}>Closing Stock Value</th>
                <th className={thClass} rowSpan={2}>Actions</th>
              </tr>
              <tr>
                {days.map(day => (
                  <React.Fragment key={`sub-${day}`}>
                    <th className="px-2 py-1 text-xs border-b border-border text-center bg-muted/30">In</th>
                    <th className="px-2 py-1 text-xs border-b border-border text-center bg-muted/30">Out</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={74} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                    Loading RM records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={74} className="px-6 py-12 text-center border-b border-border">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Archive className="w-12 h-12 mb-4 text-muted-foreground/30" />
                      <p className="text-lg font-medium text-foreground mb-1">
                        {searchQuery ? "No records match the selected filters." : "No RM records available."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-muted/50 transition-colors">
                    <td className="px-3 py-2 border-b border-border text-center text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2 border-b border-border font-medium whitespace-nowrap">{r.rmName}</td>
                    <td className="px-3 py-2 border-b border-border">{r.opn}</td>
                    <td className="px-3 py-2 border-b border-border">{r.totalIn}</td>
                    <td className="px-3 py-2 border-b border-border">{r.totalOut}</td>
                    <td className="px-3 py-2 border-b border-border">{r.clBal}</td>
                    <td className="px-3 py-2 border-b border-border">{r.rate}</td>
                    
                    {days.map(day => (
                      <React.Fragment key={`data-${r.id}-${day}`}>
                        <td className="px-2 py-1 border-b border-border text-center text-xs">
                          {r.dayWise?.[day]?.in || 0}
                        </td>
                        <td className="px-2 py-1 border-b border-border text-center text-xs text-muted-foreground">
                          {r.dayWise?.[day]?.out || 0}
                        </td>
                      </React.Fragment>
                    ))}
                    
                    <td className="px-3 py-2 border-b border-border">{r.opnStockValue}</td>
                    <td className="px-3 py-2 border-b border-border">{r.purchaseValueStock}</td>
                    <td className="px-3 py-2 border-b border-border">{r.consumptionStock}</td>
                    <td className="px-3 py-2 border-b border-border">{r.closingStockValue}</td>
                    <td className="px-3 py-2 border-b border-border text-right space-x-2 whitespace-nowrap sticky right-0 bg-card">
                      <button 
                        onClick={() => handleOpenEdit(r)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setRecordToDelete(r); setShowDeleteModal(true); }}
                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
          <div className="bg-card w-full max-w-2xl rounded-xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">{currentRecord.id ? 'Edit' : 'Add'} RM Record (Summary)</h2>
              <button onClick={() => !isSubmitting && setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <form className="p-4 overflow-y-auto" onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Raw Material Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={currentRecord.rmName || ''}
                    onChange={(e) => handleChange('rmName', e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Opn (Opening Balance)</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.opn || 0}
                    onChange={(e) => handleChange('opn', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Rate</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.rate || 0}
                    onChange={(e) => handleChange('rate', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Total In</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.totalIn || 0}
                    onChange={(e) => handleChange('totalIn', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Total Out</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.totalOut || 0}
                    onChange={(e) => handleChange('totalOut', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Closing Balance</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.clBal || 0}
                    disabled
                    className="w-full px-3 py-2 border border-input bg-muted text-muted-foreground rounded-md cursor-not-allowed" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Opn Stock Value</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.opnStockValue || 0}
                    disabled
                    className="w-full px-3 py-2 border border-input bg-muted text-muted-foreground rounded-md cursor-not-allowed" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Purchase Value Stock</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.purchaseValueStock || 0}
                    disabled
                    className="w-full px-3 py-2 border border-input bg-muted text-muted-foreground rounded-md cursor-not-allowed" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Consumption Stock</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.consumptionStock || 0}
                    disabled
                    className="w-full px-3 py-2 border border-input bg-muted text-muted-foreground rounded-md cursor-not-allowed" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Closing Stock Value</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.closingStockValue || 0}
                    disabled
                    className="w-full px-3 py-2 border border-input bg-muted text-muted-foreground rounded-md cursor-not-allowed" 
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 italic">* Note: Day-wise In/Out fields will be managed manually for now per Phase 22 structure. Balance and Values are auto-calculated.</p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-input rounded-md disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 flex items-center"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {currentRecord.id ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-sm rounded-xl shadow-xl flex flex-col p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-lg font-bold">Delete Record</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete this RM record for <strong>{recordToDelete?.rmName}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-input rounded-md disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md disabled:opacity-50 flex items-center"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
