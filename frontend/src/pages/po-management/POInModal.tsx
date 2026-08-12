import React, { useState } from 'react';
import { X, CheckCircle, CircleDashed, Info } from 'lucide-react';
import { type PurchaseOrder, executePOInTransaction } from '../../lib/firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

interface POInModalProps {
  po: PurchaseOrder;
  onClose: () => void;
  onSuccess: () => void;
}

export default function POInModal({ po, onClose, onSuccess }: POInModalProps) {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    remarks: ''
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentClosingBal = po.orderQty + (po.inQty || 0) - (po.outQty || 0);

  const validateForm = () => {
    if (!formData.date) {
      setError("Date is required.");
      return false;
    }
    
    const qtyNum = Number(formData.quantity);
    if (!formData.quantity || isNaN(qtyNum) || qtyNum <= 0) {
      setError("Quantity must be a valid positive number greater than 0.");
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submission
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await executePOInTransaction(
        po.id!,
        Number(formData.quantity),
        formData.date,
        formData.remarks.trim(),
        user?.name || 'System'
      );
      
      onSuccess(); // Triggers modal close and table refresh in parent

    } catch (error: any) {
      console.error("Error saving IN transaction:", error);
      setError(error.message || "A critical database error occurred. Transaction was not saved.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-border overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-green-500/10 to-transparent">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center">
              <span className="bg-green-500 text-white px-2 py-0.5 rounded text-sm mr-3 uppercase tracking-wider">IN</span>
              Record Material Receipt
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Receive stock against PO {po.poNo}</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            disabled={isSubmitting}
            className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm font-semibold flex items-center animate-shake">
              <Info className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Read-only PO Context */}
          <div className="mb-6 p-4 bg-muted/30 rounded-xl border border-border">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Purchase Order Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">PO No.</p>
                <p className="font-bold text-foreground text-sm">{po.poNo}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Customer</p>
                <p className="font-bold text-foreground text-sm truncate" title={po.customerName}>{po.customerName}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-[10px] text-muted-foreground uppercase">Item Name</p>
                <p className="font-bold text-foreground text-sm truncate" title={po.productName}>{po.productName}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/50">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Opening</p>
                <p className="font-bold text-foreground text-lg">{po.orderQty}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Total IN</p>
                <p className="font-bold text-green-600 text-lg">{po.inQty || 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Total OUT</p>
                <p className="font-bold text-red-600 text-lg">{po.outQty || 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Closing Bal</p>
                <p className="font-bold text-foreground text-lg">{currentClosingBal}</p>
              </div>
            </div>
          </div>

          <form id="in-tx-form" onSubmit={handleSubmit} className="space-y-5">
            
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Transaction Date *</label>
                <input 
                  type="date" 
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground transition-colors focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  value={formData.date}
                  onChange={e => {
                    setFormData({...formData, date: e.target.value});
                    if (error) setError(null);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Receive Quantity *</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  placeholder="Enter positive quantity"
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground font-black text-lg text-green-600 transition-colors focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  value={formData.quantity}
                  onChange={e => {
                    setFormData({...formData, quantity: e.target.value});
                    if (error) setError(null);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Remarks (Optional)</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground transition-colors focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                rows={2}
                placeholder="Any notes about this receipt..."
                value={formData.remarks}
                onChange={e => setFormData({...formData, remarks: e.target.value})}
              ></textarea>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose} 
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="in-tx-form"
            disabled={isSubmitting}
            className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center shadow-lg hover:bg-green-700 transition-all disabled:opacity-50 hover:shadow-green-600/20"
          >
            {isSubmitting ? <CircleDashed className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            {isSubmitting ? 'Saving...' : 'SAVE IN'}
          </button>
        </div>

      </div>
    </div>
  );
}
