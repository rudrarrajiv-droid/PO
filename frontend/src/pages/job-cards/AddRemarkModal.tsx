import React, { useState } from 'react';
import { X, MessageSquarePlus, Send } from 'lucide-react';
import { updateDocument } from '../../lib/firebase/services';
import { useAuth } from '../../contexts/AuthContext';

export default function AddRemarkModal({ jobCard, onClose, onSuccess }: { jobCard: any, onClose: () => void, onSuccess: () => void }) {
  const [remarkText, setRemarkText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarkText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newRemark = {
        text: remarkText.trim(),
        date: new Date().toISOString(),
        by: user?.name || 'System'
      };

      const existingRemarks = jobCard.remarks || [];
      const updatedRemarks = [...existingRemarks, newRemark];

      await updateDocument('jobCards', jobCard.id, {
        remarks: updatedRemarks
      }, user?.name);

      onSuccess();
    } catch (error) {
      console.error("Failed to add remark", error);
      alert("Failed to add remark. See console for details.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/30">
          <h2 className="text-lg font-bold text-foreground flex items-center">
            <MessageSquarePlus className="w-5 h-5 mr-2 text-primary" />
            Add Production Remark
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <div className="text-sm font-semibold text-foreground mb-1">Job Card: {jobCard.jobCardNo}</div>
            <div className="text-xs text-muted-foreground">{jobCard.customerName} - {jobCard.productName}</div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground block">
              Daily Progress / Status Update
            </label>
            <textarea
              required
              autoFocus
              rows={4}
              value={remarkText}
              onChange={e => setRemarkText(e.target.value)}
              placeholder="e.g. Corrugation completed, waiting for printing..."
              className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary shadow-sm resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !remarkText.trim()}
              className="bg-primary text-primary-foreground px-5 py-2 rounded-md font-medium text-sm flex items-center shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Posting...' : 'Post Remark'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
