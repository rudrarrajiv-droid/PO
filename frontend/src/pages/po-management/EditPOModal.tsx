import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { updatePurchaseOrder } from '../../lib/firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import { type PurchaseOrder } from '../../lib/firebase/services';

export default function EditPOModal({ 
  po, 
  onClose, 
  onSuccess 
}: { 
  po: PurchaseOrder, 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    poNo: po.poNo || '',
    poDate: po.poDate || '',
    deliveryDate: po.deliveryDate || '',
    customerName: po.customerName || '',
    productName: po.productName || '',
    rate: po.rate?.toString() || '0',
    orderQty: po.orderQty?.toString() || '0'
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async () => {
    try {
      if (!formData.poNo || !formData.poDate || !formData.customerName || !formData.productName) {
        setError('PO No, PO Date, Customer Name, and Item Name are required.');
        return;
      }
      
      const rateNum = Number(formData.rate);
      const qtyNum = Number(formData.orderQty);
      
      if (isNaN(rateNum) || rateNum < 0) {
        setError('Invalid rate');
        return;
      }
      
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setError('Invalid quantity');
        return;
      }

      setIsSubmitting(true);
      await updatePurchaseOrder(po.id!, {
        poNo: formData.poNo,
        poDate: formData.poDate,
        deliveryDate: formData.deliveryDate,
        customerName: formData.customerName,
        productName: formData.productName,
        rate: rateNum,
        orderQty: qtyNum
      }, user?.name || 'Unknown');
      
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update PO');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/50 rounded-t-2xl">
          <h2 className="text-lg font-black uppercase tracking-wider text-foreground">Edit Purchase Order</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-200">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">PO No.</label>
              <input 
                type="text" 
                value={formData.poNo}
                onChange={e => handleChange('poNo', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Customer</label>
              <input 
                type="text" 
                value={formData.customerName}
                onChange={e => handleChange('customerName', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">PO Date</label>
              <input 
                type="date" 
                value={formData.poDate}
                onChange={e => handleChange('poDate', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Delivery Date</label>
              <input 
                type="date" 
                value={formData.deliveryDate}
                onChange={e => handleChange('deliveryDate', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-semibold"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Item Name</label>
              <input 
                type="text" 
                value={formData.productName}
                onChange={e => handleChange('productName', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Rate</label>
              <input 
                type="number" 
                step="0.01"
                value={formData.rate}
                onChange={e => handleChange('rate', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Quantity</label>
              <input 
                type="number" 
                value={formData.orderQty}
                onChange={e => handleChange('orderQty', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-semibold"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-3 rounded-b-2xl">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-bold text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-primary text-primary-foreground font-black text-sm uppercase tracking-wider rounded-lg shadow hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
