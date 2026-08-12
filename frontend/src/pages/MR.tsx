import React, { useState, useEffect } from 'react';
import { Box, Search, Plus, Edit2, Trash2, Loader2, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getMRRecords, createMRRecord, updateMRRecord, deleteMRRecord, type MRRecord } from '../lib/firebase/mrServices';

export default function MR() {
  const { user } = useAuth();
  const [records, setRecords] = useState<MRRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [currentRecord, setCurrentRecord] = useState<Partial<MRRecord>>({});
  const [recordToDelete, setRecordToDelete] = useState<MRRecord | null>(null);
  
  // Phase 28: Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  const thClass = "px-3 py-3 border-b border-border text-left font-medium text-muted-foreground whitespace-nowrap";

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const data = await getMRRecords();
      setRecords(data);
    } catch (error) {
      console.error(error);
      showMessage('error', 'Failed to load records.');
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
      materialName: '',
      opnStock: 0,
      opnAmt: 0,
      purchaseQty: 0,
      purchaseAmt: 0,
      consumptionQty: 0,
      consumptionAmt: 0,
      closingQty: 0,
      closingAmt: 0,
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (record: MRRecord) => {
    setCurrentRecord({ ...record });
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRecord.materialName) return;

    // Phase 24: Duplicate Protection (Case-insensitive)
    if (!currentRecord.id) {
      const isDuplicate = records.some(
        (r) => r.materialName.toLowerCase() === currentRecord.materialName?.toLowerCase()
      );
      if (isDuplicate) {
        showMessage('error', 'MR record with this Material Name already exists.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (currentRecord.id) {
        await updateMRRecord(currentRecord.id, currentRecord, user?.name || 'System');
        showMessage('success', 'MR updated successfully.');
      } else {
        await createMRRecord(currentRecord as any, user?.name || 'System');
        showMessage('success', 'MR created successfully.');
      }
      setShowAddModal(false);
      fetchRecords();
    } catch (error) {
      showMessage('error', 'Failed to save MR record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!recordToDelete || !recordToDelete.id) return;
    setIsSubmitting(true);
    try {
      await deleteMRRecord(recordToDelete.id, recordToDelete.materialName, user?.name || 'System');
      showMessage('success', 'MR deleted successfully.');
      setShowDeleteModal(false);
      setRecordToDelete(null);
      fetchRecords();
    } catch (error) {
      showMessage('error', 'Failed to delete record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof MRRecord, value: any) => {
    setCurrentRecord(prev => {
      const next = { ...prev, [field]: value };
      
      // Phase 24: Auto-calculation for Closing Qty and Closing Amt
      if (['opnStock', 'purchaseQty', 'consumptionQty'].includes(field)) {
        next.closingQty = (Number(next.opnStock) || 0) + (Number(next.purchaseQty) || 0) - (Number(next.consumptionQty) || 0);
      }
      if (['opnAmt', 'purchaseAmt', 'consumptionAmt'].includes(field)) {
        next.closingAmt = (Number(next.opnAmt) || 0) + (Number(next.purchaseAmt) || 0) - (Number(next.consumptionAmt) || 0);
      }
      
      return next;
    });
  };

  const filteredRecords = records.filter(record => 
    record.materialName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const summaryTotals = filteredRecords.reduce((acc, curr) => ({
    totalQty: acc.totalQty + (Number(curr.closingQty) || 0),
    totalAmt: acc.totalAmt + (Number(curr.closingAmt) || 0)
  }), { totalQty: 0, totalAmt: 0 });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">MR (Material Receipt) Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track material receipts</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by Material Name..." 
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
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total MR Items</h3>
          <p className="text-3xl font-bold text-foreground">{filteredRecords.length}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border/50 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Closing Qty</h3>
          <p className="text-3xl font-bold text-blue-600">{summaryTotals.totalQty.toFixed(2)}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border/50 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Closing Amount</h3>
          <p className="text-3xl font-bold text-emerald-600">₹ {summaryTotals.totalAmt.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className={thClass}>Material Name</th>
                <th className={thClass}>Opn Stock</th>
                <th className={thClass}>Opn Amt</th>
                <th className={thClass}>Purchase Qty</th>
                <th className={thClass}>Purchase Amt</th>
                <th className={thClass}>Consumption Qty</th>
                <th className={thClass}>Consumption Amt</th>
                <th className={thClass}>Closing Qty</th>
                <th className={thClass}>Closing Amt</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                    Loading records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center border-b border-border">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Box className="w-12 h-12 mb-4 text-muted-foreground/30" />
                      <p className="text-lg font-medium text-foreground mb-1">
                        {searchQuery ? "No records match the selected filters." : "No MR records available."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-muted/50 transition-colors">
                    <td className="px-3 py-3 border-b border-border font-medium">{r.materialName}</td>
                    <td className="px-3 py-3 border-b border-border">{r.opnStock}</td>
                    <td className="px-3 py-3 border-b border-border">{r.opnAmt}</td>
                    <td className="px-3 py-3 border-b border-border">{r.purchaseQty}</td>
                    <td className="px-3 py-3 border-b border-border">{r.purchaseAmt}</td>
                    <td className="px-3 py-3 border-b border-border">{r.consumptionQty}</td>
                    <td className="px-3 py-3 border-b border-border">{r.consumptionAmt}</td>
                    <td className="px-3 py-3 border-b border-border">{r.closingQty}</td>
                    <td className="px-3 py-3 border-b border-border">{r.closingAmt}</td>
                    <td className="px-3 py-3 border-b border-border text-right space-x-2">
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
              <h2 className="text-lg font-bold">{currentRecord.id ? 'Edit' : 'Add'} MR Record</h2>
              <button onClick={() => !isSubmitting && setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <form className="p-4 overflow-y-auto" onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">Material Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={currentRecord.materialName || ''}
                    onChange={(e) => handleChange('materialName', e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Opn Stock</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.opnStock || 0}
                    onChange={(e) => handleChange('opnStock', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Opn Amt</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.opnAmt || 0}
                    onChange={(e) => handleChange('opnAmt', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Purchase Qty</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.purchaseQty || 0}
                    onChange={(e) => handleChange('purchaseQty', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Purchase Amt</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.purchaseAmt || 0}
                    onChange={(e) => handleChange('purchaseAmt', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Consumption Qty</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.consumptionQty || 0}
                    onChange={(e) => handleChange('consumptionQty', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Consumption Amt</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.consumptionAmt || 0}
                    onChange={(e) => handleChange('consumptionAmt', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Closing Qty</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.closingQty || 0}
                    disabled
                    className="w-full px-3 py-2 border border-input bg-muted text-muted-foreground rounded-md cursor-not-allowed" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Closing Amt</label>
                  <input 
                    type="number" step="0.01" 
                    value={currentRecord.closingAmt || 0}
                    disabled
                    className="w-full px-3 py-2 border border-input bg-muted text-muted-foreground rounded-md cursor-not-allowed" 
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 italic">* Note: Closing Qty and Closing Amt are automatically calculated based on inputs.</p>

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
              Are you sure you want to delete this MR record for <strong>{recordToDelete?.materialName}</strong>? This action cannot be undone.
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
