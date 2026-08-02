import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowDownToLine, X, CircleDashed, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { executeBatchCreate } from '../../lib/firebase/services';
import { writeBatch, collection, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';

interface ReelRow {
  reelNo: string;
  weight: number | '';
  paperType: string;
  size: number | '';
  bf: string;
  gsm: number | '';
}

interface BulkInwardForm {
  supplierName: string;
  manufacturerName: string;
  rows: ReelRow[];
}

// Helper to increment reel number (e.g., R-1001 -> R-1002)
const incrementReelNo = (prevNo: string): string => {
  if (!prevNo) return '';
  const match = prevNo.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const numStr = match[2];
    const nextNum = (parseInt(numStr, 10) + 1).toString().padStart(numStr.length, '0');
    return prefix + nextNum;
  }
  return prevNo + '-2'; // fallback
};

export default function BulkInwardModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { register, control, handleSubmit, watch, getValues, setValue } = useForm<BulkInwardForm>({
    defaultValues: {
      supplierName: '',
      manufacturerName: '',
      rows: [{ reelNo: '', weight: '', paperType: 'Kraft', size: '', bf: '', gsm: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rows'
  });

  const rows = watch('rows');
  const validReelsCount = rows.filter(r => Number(r.weight) > 0).length;
  const totalWeight = rows.reduce((acc, r) => acc + (Number(r.weight) || 0), 0);

  // Auto-scroll to bottom when a new row is added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [fields.length]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // prevent form submit
      // Only generate next row if we are on the last row
      if (index === fields.length - 1) {
        const currentRow = getValues(`rows.${index}`);
        
        // Auto-populate next row
        append({
          reelNo: incrementReelNo(currentRow.reelNo),
          weight: '', // Empty weight for new row
          paperType: currentRow.paperType,
          size: currentRow.size,
          bf: currentRow.bf,
          gsm: currentRow.gsm
        });

        // Focus logic could go here, but React Hook Form makes it tricky without explicit refs.
        // The user can tab to the next weight input easily.
      }
    }
  };

  const onSubmit = async (data: BulkInwardForm) => {
    // Filter out rows without weight
    const validRows = data.rows.filter(r => Number(r.weight) > 0);
    
    if (validRows.length === 0) {
      alert("No valid reels with weight found to submit.");
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const timestamp = serverTimestamp();
      
      const reelsCol = collection(db, 'reels');
      const txCol = collection(db, 'reelTransactions');

      validRows.forEach(row => {
        // 1. Create Reel Document
        const reelDoc = doc(reelsCol);
        const reelData = {
          reelNumber: row.reelNo.toUpperCase(),
          supplierName: data.supplierName,
          manufacturerName: data.manufacturerName,
          weight: Number(row.weight),
          currentBalance: Number(row.weight),
          paperType: row.paperType,
          reelSize: Number(row.size),
          bf: row.bf,
          gsm: Number(row.gsm),
          inwardDate: new Date().toISOString(), // client side for quick sort
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: user?.name || 'System',
          updatedBy: user?.name || 'System',
          isArchived: false,
        };
        batch.set(reelDoc, reelData);

        // 2. Create corresponding Reel Transaction (INWARD)
        const txDoc = doc(txCol);
        batch.set(txDoc, {
          reelId: reelDoc.id,
          reelNumber: row.reelNo.toUpperCase(),
          type: 'INWARD',
          quantity: Number(row.weight),
          remainingBalance: Number(row.weight),
          performedBy: user?.name || 'System',
          date: new Date().toISOString(),
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: user?.name || 'System',
          updatedBy: user?.name || 'System',
          isArchived: false,
        });
      });

      await batch.commit();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert('Failed to save bulk inward: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-foreground flex items-center">
              <ArrowDownToLine className="w-5 h-5 mr-2 text-green-500" />
              Bulk Reel Inward
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Press ENTER on any field in the last row to automatically generate the next reel.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="bulk-inward-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          
          {/* Top Level Metadata */}
          <div className="p-6 bg-secondary/20 border-b border-border grid grid-cols-2 gap-6 shrink-0">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-muted-foreground">Supplier Name <span className="text-destructive">*</span></label>
              <input {...register('supplierName', { required: true })} className={inputCls} placeholder="e.g. ABC Paper Mills" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-muted-foreground">Manufacturer Name <span className="text-destructive">*</span></label>
              <input {...register('manufacturerName', { required: true })} className={inputCls} placeholder="e.g. ABC Paper Mills" />
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-6 py-3 bg-secondary/50 border-b border-border text-xs font-semibold uppercase text-muted-foreground shrink-0">
            <div>Reel Number</div>
            <div>Weight (Kg)</div>
            <div>Paper Type</div>
            <div>Size (in)</div>
            <div>BF</div>
            <div>GSM</div>
            <div className="w-8"></div>
          </div>

          {/* Rows Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3" ref={containerRef}>
            {fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 items-start group">
                <input 
                  {...register(`rows.${idx}.reelNo` as const)} 
                  className={inputCls + " font-mono font-bold text-primary uppercase"} 
                  placeholder="R-1001"
                  onKeyDown={(e) => handleKeyDown(e, idx)} 
                />
                
                <input 
                  type="number" step="0.1" 
                  {...register(`rows.${idx}.weight` as const)} 
                  className={inputCls} 
                  placeholder="0.0" 
                  onKeyDown={(e) => handleKeyDown(e, idx)} 
                />
                
                <select 
                  {...register(`rows.${idx}.paperType` as const)} 
                  className={inputCls}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                >
                  <option value="Kraft">Kraft</option>
                  <option value="Semi-Kraft">Semi-Kraft</option>
                  <option value="Duplex">Duplex</option>
                  <option value="Test">Test</option>
                </select>
                
                <input 
                  type="number" step="0.1" 
                  {...register(`rows.${idx}.size` as const)} 
                  className={inputCls} 
                  placeholder='e.g. 32"' 
                  onKeyDown={(e) => handleKeyDown(e, idx)} 
                />
                
                <input 
                  {...register(`rows.${idx}.bf` as const)} 
                  className={inputCls} 
                  placeholder="e.g. 16" 
                  onKeyDown={(e) => handleKeyDown(e, idx)} 
                />
                
                <input 
                  type="number" 
                  {...register(`rows.${idx}.gsm` as const)} 
                  className={inputCls} 
                  placeholder="e.g. 100" 
                  onKeyDown={(e) => handleKeyDown(e, idx)} 
                />

                <div className="w-8 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(idx)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={() => append({ reelNo: '', weight: '', paperType: 'Kraft', size: '', bf: '', gsm: '' })}
              className="flex items-center text-sm text-primary hover:underline mt-4 px-2"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Empty Row
            </button>
          </div>
        </form>

        {/* Footer / Live Summary */}
        <div className="p-6 border-t border-border flex items-center justify-between bg-card shrink-0 rounded-b-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          
          <div className="flex gap-8 px-4 py-2 bg-secondary/30 rounded-lg border border-border/50">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Valid Reels</div>
              <div className="text-xl font-bold text-foreground">{validReelsCount}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Weight</div>
              <div className="text-xl font-bold text-green-600">{totalWeight.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">Kg</span></div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-secondary transition-colors">
              Cancel
            </button>
            <button type="submit" form="bulk-inward-form" disabled={isSubmitting} className="px-8 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center shadow-lg shadow-green-600/20">
              {isSubmitting && <CircleDashed className="w-4 h-4 mr-2 animate-spin" />}
              Save All Valid Reels
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
