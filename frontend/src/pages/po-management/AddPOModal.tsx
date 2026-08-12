import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2, PackageSearch } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { queryDocuments, logActivity, type PurchaseOrder } from '../../lib/firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import RMStatusPanel from './RMStatusPanel';

type POItem = {
  id: string; // internal UI id
  productId: string;
  rate: string;
  orderQty: string;
  deliveryDate: string;
};

export default function AddPOModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  
  const [commonData, setCommonData] = useState({
    poNo: '',
    poDate: new Date().toISOString().split('T')[0],
    customerId: '',
    consignee: '',
  });

  const [items, setItems] = useState<POItem[]>([
    { id: Math.random().toString(36).substring(7), productId: '', rate: '', orderQty: '', deliveryDate: '' }
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => queryDocuments('customers', []) as Promise<any[]>
  });

  // Fetch Products
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => queryDocuments('products', []) as Promise<any[]>
  });

  const handleAddItem = () => {
    setItems([...items, { id: Math.random().toString(36).substring(7), productId: '', rate: '', orderQty: '', deliveryDate: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof POItem, value: string) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    if (errors[`${field}-${id}`]) {
      const newErrors = { ...errors };
      delete newErrors[`${field}-${id}`];
      setErrors(newErrors);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!commonData.poNo.trim()) newErrors.poNo = "PO No. is required.";
    if (!commonData.poDate) newErrors.poDate = "PO Date is required.";
    if (!commonData.customerId) newErrors.customerId = "Customer is required.";
    
    if (items.length === 0) {
      newErrors.general = "At least one item must be added.";
    }

    const selectedProductIds = new Set<string>();

    items.forEach((item, index) => {
      if (!item.productId) newErrors[`productId-${item.id}`] = "Required";
      else {
        if (selectedProductIds.has(item.productId)) {
           newErrors[`productId-${item.id}`] = "Duplicate item in list";
        }
        selectedProductIds.add(item.productId);
      }
      
      const rateNum = Number(item.rate);
      if (!item.rate || isNaN(rateNum) || rateNum < 0) {
        newErrors[`rate-${item.id}`] = "Invalid";
      }
      
      const qtyNum = Number(item.orderQty);
      if (!item.orderQty || isNaN(qtyNum) || qtyNum <= 0) {
        newErrors[`orderQty-${item.id}`] = "Invalid";
      }

      if (!item.deliveryDate) {
        newErrors[`deliveryDate-${item.id}`] = "Required";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; 
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // 1. Duplicate check for this PO No in the database
      const q = query(collection(db, 'purchaseOrders'), where('poNo', '==', commonData.poNo.trim()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        setErrors({ poNo: "This Purchase Order number already exists in the system." });
        setIsSubmitting(false);
        return;
      }

      const customer = customers.find(c => c.id === commonData.customerId);
      if (!customer) {
        setErrors({ general: "Invalid customer selected." });
        setIsSubmitting(false);
        return;
      }

      // 2. Prepare batch write
      const batch = writeBatch(db);
      let successCount = 0;

      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;

        const rate = Number(item.rate);
        const opnQty = Number(item.orderQty);
        const inQty = 0;
        const outQty = 0;

        const newPO: PurchaseOrder = {
          poNo: commonData.poNo.trim(),
          poDate: commonData.poDate,
          deliveryDate: item.deliveryDate,
          customerId: customer.id,
          customerName: customer.name || '',
          consignee: commonData.consignee.trim(),
          productId: product.id,
          productName: product.name || '',
          artworkNo: product.artworkNo || '',
          size: `${product.length || ''}x${product.width || ''}x${product.height || ''} ${product.unit || ''}`.trim(),
          rate: rate,
          orderQty: opnQty,
          inQty: inQty,
          outQty: outQty,
          status: 'OPEN',
          isArchived: false
        };

        const docRef = doc(collection(db, 'purchaseOrders'));
        batch.set(docRef, {
          ...newPO,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user?.name || 'System',
          updatedBy: user?.name || 'System',
        });
        successCount++;
      }

      if (successCount === 0) {
         setErrors({ general: "No valid items to save." });
         setIsSubmitting(false);
         return;
      }

      // Commit the batch
      await batch.commit();
      
      // Log Activity
      await logActivity({
        user: user?.name || 'System',
        action: `Created Bulk PO ${commonData.poNo.trim()} with ${successCount} items`,
        entity: 'purchaseOrders',
        referenceId: commonData.poNo.trim(),
        timestamp: serverTimestamp()
      });
      
      onSuccess(); 

    } catch (error: any) {
      console.error("Error creating bulk PO:", error);
      setErrors({ general: `A critical database error occurred. ${error?.message || ''}` });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-border overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
          <div>
            <h2 className="text-xl font-bold text-foreground">Create Purchase Order (Bulk Add)</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Add a new PO with multiple items</p>
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
        <div className="p-5 overflow-y-auto flex-1">
          {errors.general && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm font-semibold flex items-center">
               {errors.general}
            </div>
          )}

          <form id="add-po-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Common Fields */}
            <div className="bg-muted/20 p-4 rounded-xl border border-border space-y-4">
              <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider mb-2 border-b pb-2">Common Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-muted-foreground mb-1">PO No. *</label>
                  <input 
                    type="text" 
                    className={cn(
                      "w-full px-3 py-2 text-sm rounded-lg border bg-background text-foreground transition-colors font-bold",
                      errors.poNo ? "border-red-500 focus:ring-red-200" : "border-input focus:ring-primary/20"
                    )}
                    value={commonData.poNo}
                    onChange={e => {
                      setCommonData({...commonData, poNo: e.target.value});
                      if (errors.poNo) setErrors({...errors, poNo: ''});
                    }}
                  />
                  {errors.poNo && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.poNo}</p>}
                </div>
                
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Customer *</label>
                  <select
                    className={cn(
                      "w-full px-3 py-2 text-sm rounded-lg border bg-background text-foreground transition-colors font-medium",
                      errors.customerId ? "border-red-500 focus:ring-red-200" : "border-input focus:ring-primary/20"
                    )}
                    value={commonData.customerId}
                    onChange={e => {
                      setCommonData({...commonData, customerId: e.target.value});
                      if (errors.customerId) setErrors({...errors, customerId: ''});
                    }}
                  >
                    <option value="">Select Customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name?.trim()}</option>
                    ))}
                  </select>
                  {errors.customerId && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.customerId}</p>}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-muted-foreground mb-1">PO Date *</label>
                  <input 
                    type="date" 
                    className={cn(
                      "w-full px-3 py-2 text-sm rounded-lg border bg-background text-foreground transition-colors",
                      errors.poDate ? "border-red-500 focus:ring-red-200" : "border-input focus:ring-primary/20"
                    )}
                    value={commonData.poDate}
                    onChange={e => {
                      setCommonData({...commonData, poDate: e.target.value});
                      if (errors.poDate) setErrors({...errors, poDate: ''});
                    }}
                  />
                  {errors.poDate && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.poDate}</p>}
                </div>
                
                <div className="md:col-span-1">
                   <label className="block text-xs font-bold text-muted-foreground mb-1">Consignee (Optional)</label>
                   <input 
                     type="text"
                     placeholder="Enter consignee details"
                     className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground transition-colors"
                     value={commonData.consignee}
                     onChange={e => setCommonData({...commonData, consignee: e.target.value})}
                   />
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider">Line Items</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md text-xs font-bold flex items-center transition-colors"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Item
                </button>
              </div>

              <div className="bg-muted/10 border rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-secondary/50 text-muted-foreground uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-3 py-2 w-10 text-center">#</th>
                      <th className="px-3 py-2 min-w-[250px]">Item Name *</th>
                      <th className="px-3 py-2 w-28">Rate (₹) *</th>
                      <th className="px-3 py-2 w-28">Qty *</th>
                      <th className="px-3 py-2 w-36">Delivery *</th>
                      <th className="px-3 py-2 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                     {items.map((item, index) => (
                      <React.Fragment key={item.id}>
                       <tr className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 text-center font-bold text-xs text-muted-foreground">{index + 1}</td>
                        <td className="px-3 py-2">
                          <select
                            className={cn(
                              "w-full px-2 py-1.5 text-sm rounded border bg-background text-foreground transition-colors font-medium",
                              errors[`productId-${item.id}`] ? "border-red-500 focus:ring-red-200" : "border-input focus:ring-primary/20"
                            )}
                            value={item.productId}
                            onChange={e => handleItemChange(item.id, 'productId', e.target.value)}
                          >
                            <option value="">Select Item...</option>
                            {products.map(p => {
                              const nameStr = p.name?.trim() || '';
                              const artworkStr = p.artworkNo?.trim() ? `(${p.artworkNo.trim()})` : '';
                              return (
                                <option key={p.id} value={p.id}>
                                  {nameStr} {artworkStr}
                                </option>
                              );
                            })}
                          </select>
                          {errors[`productId-${item.id}`] && <span className="text-red-500 text-[10px] font-bold block">{errors[`productId-${item.id}`]}</span>}
                        </td>
                        <td className="px-3 py-2">
                           <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            className={cn(
                              "w-full px-2 py-1.5 text-sm rounded border bg-background text-foreground transition-colors font-bold text-right",
                              errors[`rate-${item.id}`] ? "border-red-500 focus:ring-red-200" : "border-input focus:ring-primary/20"
                            )}
                            value={item.rate}
                            onChange={e => handleItemChange(item.id, 'rate', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                           <input 
                            type="number" 
                            min="1"
                            className={cn(
                              "w-full px-2 py-1.5 text-sm rounded border bg-background text-foreground transition-colors font-bold text-right",
                              errors[`orderQty-${item.id}`] ? "border-red-500 focus:ring-red-200" : "border-input focus:ring-primary/20"
                            )}
                            value={item.orderQty}
                            onChange={e => handleItemChange(item.id, 'orderQty', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                           <input 
                            type="date"
                            className={cn(
                              "w-full px-2 py-1.5 text-sm rounded border bg-background text-foreground transition-colors font-bold",
                              errors[`deliveryDate-${item.id}`] ? "border-red-500 focus:ring-red-200" : "border-input focus:ring-primary/20"
                            )}
                            value={item.deliveryDate}
                            onChange={e => handleItemChange(item.id, 'deliveryDate', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={items.length === 1}
                            className="text-red-500/70 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {/* Phase 2: RM Status Panel - shows live shortage below each item */}
                      {item.productId && Number(item.orderQty) > 0 && (
                        <tr key={`rm-${item.id}`}>
                          <td colSpan={6} className="px-3 pb-2">
                            <RMStatusPanel productId={item.productId} orderQty={Number(item.orderQty)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg font-bold text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            form="add-po-form"
            type="submit" 
            disabled={isSubmitting}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50 flex items-center"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Batch...</>
            ) : (
              `Save ${items.length} ${items.length === 1 ? 'Item' : 'Items'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
