import React, { useState } from 'react';
import { X, CircleDashed, CheckCircle } from 'lucide-react';
import { updateDocument } from '../../lib/firebase/services';
import { useAuth } from '../../contexts/AuthContext';

export default function CompleteProductionModal({ jobCard, onClose, onSuccess }: { jobCard: any, onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fgQty, setFgQty] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const fg = Number(fgQty);
    if (isNaN(fg) || fg <= 0) {
      alert("Please enter a valid Finished Goods (FG) Quantity.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const now = new Date();
      const expected = new Date(jobCard.expectedDeliveryAt);
      const isDelayed = now > expected;

      const payload = {
        status: 'COMPLETED',
        completedAt: now.toISOString(),
        completedBy: user?.name || 'System',
        fgQty: fg,
        completionStatus: isDelayed ? 'DELAYED' : 'ON TIME'
      };

      await updateDocument('jobCards', jobCard.id, payload, user?.name);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to complete job card');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-card w-full max-w-md rounded-xl shadow-2xl flex flex-col border border-border">
        
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0 bg-green-50">
          <div>
            <h2 className="text-xl font-bold text-green-900 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Complete Production
            </h2>
            <p className="text-xs text-green-700 mt-1 font-medium">Job Card: {jobCard.jobCardNo}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 flex-1 flex flex-col gap-6">
          
          <div className="bg-secondary/30 p-4 rounded-lg border border-border text-sm">
            <p className="mb-2">You are marking this Job Card as <span className="font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">COMPLETED</span>.</p>
            <p className="text-muted-foreground text-xs">This will record the exact completion time and remove it from the active production queue.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase">Order Qty</p>
              <p className="text-lg font-bold">{jobCard.orderQty}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase">Expected Delivery</p>
              <p className="text-sm font-bold">{new Date(jobCard.expectedDeliveryAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-sm font-bold text-foreground">
              Finished Goods (FG) Quantity <span className="text-destructive">*</span>
            </label>
            <input 
              type="number" 
              required
              min="1"
              value={fgQty}
              onChange={(e) => setFgQty(e.target.value)}
              placeholder="Enter FG Quantity produced..."
              className="w-full text-lg font-bold rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !fgQty}
              className="px-6 py-2 text-sm font-bold rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors shadow flex items-center disabled:opacity-50"
            >
              {isSubmitting && <CircleDashed className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Completion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
