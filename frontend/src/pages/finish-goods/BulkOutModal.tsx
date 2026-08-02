import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowUpFromLine, X, CircleDashed, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { executeFinishGoodOutwardTransaction, type FinishGoodOutwardPayload, type LogisticsPayload } from '../../lib/firebase/services';
import { queryDocuments } from '../../lib/firebase/services';

interface FGRow {
  productId: string;
  customerName: string;
  productName: string;
  category: 'DISPATCH' | 'NON-MOVING';
  quantity: number | '';
}

interface BulkOutwardForm extends LogisticsPayload {
  rows: FGRow[];
}

export default function BulkOutModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fetch available finished goods (so we only show products that have stock)
  const [finishGoods, setFinishGoods] = useState<any[]>([]);
  
  useEffect(() => {
    queryDocuments('finishGoods', []).then(data => {
      setFinishGoods(data);
    });
  }, []);

  const { register, control, handleSubmit, watch, getValues, setValue } = useForm<BulkOutwardForm>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      invoiceNo: '',
      place: '',
      transporterName: '',
      vehicleNo: '',
      vehicleSize: '',
      freight: 0,
      holding: 0,
      point: '',
      others: '',
      rows: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rows'
  });

  // Initialize first row
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && fields.length === 0) {
      initialized.current = true;
      append({ 
        productId: '',
        customerName: '',
        productName: '',
        category: 'DISPATCH',
        quantity: ''
      });
    }
  }, [append]);

  const rows = watch('rows');

  const handleProductChange = (index: number, productId: string) => {
    const fg = finishGoods.find(p => p.productId === productId);
    if (fg) {
      setValue(`rows.${index}.customerName`, fg.customerName || '');
      setValue(`rows.${index}.productName`, fg.productName || '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentVal = getValues(`rows.${index}.quantity`);
      if (currentVal && String(currentVal) !== '') {
        const prevRow = getValues(`rows.${index}`);
        append({
          productId: prevRow.productId,
          customerName: prevRow.customerName,
          productName: prevRow.productName,
          category: prevRow.category,
          quantity: ''
        });
        setTimeout(() => {
          if (containerRef.current) {
            const inputs = containerRef.current.querySelectorAll<HTMLInputElement>('input[name$=".quantity"]');
            const nextInput = inputs[index + 1];
            if (nextInput) {
              nextInput.focus();
            }
          }
        }, 50);
      }
    }
  };

  const onSubmit = async (data: BulkOutwardForm) => {
    const validRows = data.rows.filter(r => r.quantity && Number(r.quantity) > 0 && r.productId);
    
    if (validRows.length === 0) {
      alert("Please enter at least one valid row with a product and quantity.");
      return;
    }
    
    if (!data.invoiceNo) {
      alert("Invoice No. is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payloads: FinishGoodOutwardPayload[] = validRows.map(r => ({
        productId: r.productId,
        quantity: Number(r.quantity),
        category: r.category
      }));

      const logistics: LogisticsPayload = {
        date: data.date,
        invoiceNo: data.invoiceNo,
        place: data.place,
        transporterName: data.transporterName,
        vehicleNo: data.vehicleNo,
        vehicleSize: data.vehicleSize,
        freight: Number(data.freight) || 0,
        holding: Number(data.holding) || 0,
        point: data.point,
        others: data.others
      };

      await executeFinishGoodOutwardTransaction(logistics, payloads, user?.name || 'System');
      onSuccess();
    } catch (error: any) {
      console.error("Bulk OUT failed", error);
      alert(error.message || "Failed to submit Bulk OUT. See console for details.");
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full text-sm rounded-md border border-input px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary shadow-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-6xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-destructive/10 shrink-0">
          <h2 className="text-xl font-bold text-foreground flex items-center">
            <ArrowUpFromLine className="w-6 h-6 mr-3 text-destructive" />
            Finish Goods Bulk OUT (Dispatch)
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Logistics Section */}
          <div className="p-5 border-b border-border bg-card shrink-0">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Logistics & Freight Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Date</label>
                <input type="date" required {...register('date')} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Invoice No. <span className="text-red-500">*</span></label>
                <input type="text" required {...register('invoiceNo')} className={inputCls} placeholder="INV-001" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Place</label>
                <input type="text" {...register('place')} className={inputCls} placeholder="City/Location" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Transporter Name</label>
                <input type="text" {...register('transporterName')} className={inputCls} placeholder="Transporter..." />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Vehicle No.</label>
                <input type="text" {...register('vehicleNo')} className={inputCls} placeholder="UP14 XX 0000" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Vehicle Size</label>
                <input type="text" {...register('vehicleSize')} className={inputCls} placeholder="e.g. 17ft" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Freight (₹)</label>
                <input type="number" step="0.01" {...register('freight')} className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Holding Charges</label>
                <input type="number" step="0.01" {...register('holding')} className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Point</label>
                <input type="text" {...register('point')} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Others</label>
                <input type="text" {...register('others')} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-auto p-5 bg-muted/20" ref={containerRef}>
            <div className="min-w-[800px]">
              <div className="grid grid-cols-12 gap-3 mb-3 px-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-5">Product Name</div>
                <div className="col-span-3">Customer</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-1 text-right">Qty OUT</div>
                <div className="col-span-1 text-center">Action</div>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-3 mb-3 items-start bg-card p-2 rounded-lg border border-border shadow-sm">
                  
                  {/* Product */}
                  <div className="col-span-5">
                    <select
                      {...register(`rows.${index}.productId` as const)}
                      onChange={(e) => {
                         register(`rows.${index}.productId`).onChange(e);
                         handleProductChange(index, e.target.value);
                      }}
                      className={inputCls}
                      required
                    >
                      <option value="">Select Available Product...</option>
                      {finishGoods.map(p => (
                        <option key={p.id} value={p.productId}>
                          {p.productName} (Reg: {p.closingBalance || 0}, Non: {p.nonMovingBalance || 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Customer */}
                  <div className="col-span-3">
                    <input
                      type="text"
                      {...register(`rows.${index}.customerName` as const)}
                      className={inputCls + " bg-muted/30"}
                      placeholder="Auto-filled"
                      readOnly
                    />
                  </div>

                  {/* Category */}
                  <div className="col-span-2">
                    <select
                      {...register(`rows.${index}.category` as const)}
                      className={inputCls + (rows[index]?.category === 'NON-MOVING' ? " text-orange-600 font-semibold" : " text-blue-600 font-semibold")}
                    >
                      <option value="DISPATCH">DISPATCH (Sale)</option>
                      <option value="NON-MOVING">NON-MOVING (Reject)</option>
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-1">
                    <input
                      type="number"
                      {...register(`rows.${index}.quantity` as const)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className={inputCls + " text-right font-bold text-red-600"}
                      placeholder="0"
                    />
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-center pt-1">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => append({ 
                productId: '', customerName: '', productName: '', category: 'DISPATCH', quantity: '' 
              })}
              className="mt-4 flex items-center text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Another Row
            </button>
          </div>

          {/* Footer Actions */}
          <div className="p-5 border-t border-border bg-card shrink-0 flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">
              Total Entries: {rows.filter(r => r.quantity && Number(r.quantity) > 0 && r.productId).length} / {rows.length}
            </div>
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-destructive text-destructive-foreground px-6 py-2.5 rounded-lg font-bold text-sm flex items-center shadow-lg hover:bg-destructive/90 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <CircleDashed className="w-5 h-5 mr-2 animate-spin" /> : <ArrowUpFromLine className="w-5 h-5 mr-2" />}
                {isSubmitting ? 'Processing...' : 'Submit Dispatch (OUT)'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
