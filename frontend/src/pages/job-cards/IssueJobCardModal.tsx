import React, { useState } from 'react';
import { X, CircleDashed, Play } from 'lucide-react';
import { updateDocument, executeJobCardTransaction } from '../../lib/firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

export default function IssueJobCardModal({ jobCard, onClose, onSuccess }: { jobCard: any, onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deliveryDateTime, setDeliveryDateTime] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!deliveryDateTime) {
      alert("Expected Delivery / Dispatch Date is mandatory to issue a Job Card.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = {
        status: 'IN_PROCESS',
        issuedAt: new Date().toISOString(), // Native timestamp
        issuedBy: user?.name || 'System',
        expectedDeliveryAt: new Date(deliveryDateTime).toISOString()
      };

      await executeJobCardTransaction(jobCard.id, payload, jobCard, user?.name);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to issue job card');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-card w-full max-w-md rounded-xl shadow-2xl flex flex-col border border-border max-h-[90vh]">
        
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0 bg-blue-50">
          <div>
            <h2 className="text-xl font-bold text-blue-900 flex items-center">
              <Play className="w-5 h-5 mr-2" />
              Issue to Production
            </h2>
            <p className="text-xs text-blue-700 mt-1 font-medium">Job Card: {jobCard.jobCardNo}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
          
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
            <div className="bg-secondary/30 p-4 rounded-lg border border-border text-sm">
              <p className="mb-2">You are about to issue this Job Card to the production floor. The status will change from <span className="font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">PENDING</span> to <span className="font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">IN_PROCESS</span>.</p>
              <p className="font-bold text-destructive">Warning: This action requires a strict production deadline.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">
                Expected Delivery / Dispatch Date <span className="text-destructive">*</span>
              </label>
              <input 
                type="date" 
                required
                value={deliveryDateTime}
                onChange={(e) => setDeliveryDateTime(e.target.value)}
                className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              <p className="text-xs text-muted-foreground">Select the date the production must be completed by.</p>
            </div>
          </div>

          <div className="p-4 border-t border-border flex justify-end gap-3 bg-card shrink-0 rounded-b-xl">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !deliveryDateTime}
              className="px-6 py-2 text-sm font-bold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow flex items-center disabled:opacity-50"
            >
              {isSubmitting && <CircleDashed className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
