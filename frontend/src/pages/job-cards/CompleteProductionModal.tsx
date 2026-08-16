import React, { useState, useMemo } from 'react';
import { X, CircleDashed, CheckCircle, AlertTriangle, Plus, Search, Link as LinkIcon } from 'lucide-react';
import { getProducts, createProduct } from '../../lib/supabase/productService';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { executeProductionCompletionTransaction, type FinishGoodInwardPayload } from '../../lib/supabase/finishGoodService';

export default function CompleteProductionModal({ jobCard, onClose, onSuccess }: { jobCard: any, onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [completionType, setCompletionType] = useState<'PART' | 'FINAL'>('FINAL');
  const [productionQty, setProductionQty] = useState('');
  const [rate, setRate] = useState('');
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Master Data Linking State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedLinkProductId, setSelectedLinkProductId] = useState('');

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => getProducts() as unknown as Promise<any[]>
  });

  const totalRequired = Number(jobCard.orderQty) || 0;
  const producedSoFar = Number(jobCard.producedQty) || 0;
  const pendingBalance = Math.max(0, totalRequired - producedSoFar);

  // Auto-fill quantity when FINAL is selected
  const handleTypeChange = (type: 'PART' | 'FINAL') => {
    setCompletionType(type);
    if (type === 'FINAL') {
      setProductionQty(pendingBalance.toString());
    } else {
      setProductionQty('');
    }
  };

  const executeCompletion = async (productIdToUse: string, productData: any) => {
    const qty = Number(productionQty);
    try {
      setIsSubmitting(true);
      
      const now = new Date();
      const expected = new Date(jobCard.expectedDeliveryAt);
      const isDelayed = now > expected;

      const newProducedTotal = producedSoFar + qty;

      const newJobCardPayload: any = {
        producedQty: newProducedTotal,
        // Ensure we always save the linked product ID back to the Job Card so we don't have to link again
        productId: productIdToUse, 
        productName: productData.itemName || productData.artworkNo || jobCard.productName,
        customerName: productData.customerName || jobCard.customerName
      };

      if (completionType === 'FINAL') {
        newJobCardPayload.status = 'COMPLETED';
        newJobCardPayload.completedAt = now.toISOString();
        newJobCardPayload.completedBy = user?.name || 'System';
        newJobCardPayload.completionStatus = isDelayed ? 'DELAYED' : 'ON TIME';
      }

      const fgPayload: FinishGoodInwardPayload = {
        productId: productIdToUse,
        productName: productData.itemName || productData.artworkNo || jobCard.productName,
        customerId: productData.customerId || '',
        customerName: productData.customerName || jobCard.customerName,
        quantity: qty,
        category: 'REGULAR',
        date: completionDate,
        rate: Number(rate) || 0
      };

      await executeProductionCompletionTransaction(jobCard.id, newJobCardPayload, jobCard, fgPayload, user?.name || 'System');
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to complete job card');
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const qty = Number(productionQty);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter a valid Production Quantity.");
      return;
    }

    // Master Data Validation
    const exactMatch = products.find(p => p.id === jobCard.productId);
    
    if (exactMatch) {
      // All good, execute
      await executeCompletion(exactMatch.id, exactMatch);
    } else {
      // Mismatch! Show Link Modal
      setShowLinkModal(true);
    }
  };

  const handleQuickAdd = async () => {
    try {
      setIsSubmitting(true);
      const newId = await createProduct({
        itemName: jobCard.productName,
        customerName: jobCard.customerName,
        customerId: jobCard.customerId || '',
        type: 'CUSTOM', // Default type
      }, user?.name || 'System');
      
      const newProduct = {
        id: newId,
        itemName: jobCard.productName,
        customerName: jobCard.customerName,
        customerId: jobCard.customerId || ''
      };
      
      await executeCompletion(newId, newProduct);
    } catch (err) {
      alert("Failed to create Master Data entry");
      setIsSubmitting(false);
    }
  };

  const handleLinkExisting = async () => {
    if (!selectedLinkProductId) return;
    const match = products.find(p => p.id === selectedLinkProductId);
    if (match) {
      await executeCompletion(match.id, match);
    }
  };

  if (showLinkModal) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
        <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl flex flex-col border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border bg-orange-50">
            <h2 className="text-xl font-bold text-orange-900 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Master Data Mismatch
            </h2>
            <button onClick={() => setShowLinkModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            <p className="text-sm text-foreground">
              We couldn't find an exact match for this Job Card's product in the Finish Goods Master Data. 
              <br/><br/>
              <strong>Job Card Details:</strong><br/>
              Product: <span className="text-blue-700 font-bold">{jobCard.productName}</span><br/>
              Customer: <span className="text-blue-700 font-bold">{jobCard.customerName}</span>
            </p>

            <div className="border-t border-border pt-4">
              <h3 className="font-bold text-sm mb-3">Option 1: Add as New Item</h3>
              <button 
                onClick={handleQuickAdd}
                disabled={isSubmitting}
                className="w-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 p-3 rounded-lg font-bold flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Quick Add to Finish Goods Master Data
              </button>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="font-bold text-sm mb-3">Option 2: Link to Existing Item</h3>
              <div className="flex gap-2">
                <select 
                  value={selectedLinkProductId}
                  onChange={e => setSelectedLinkProductId(e.target.value)}
                  className="flex-1 text-sm rounded-md border border-input px-3 py-2 bg-background focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Search & Select Existing Item --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.itemName || p.artworkNo} ({p.customerName})</option>
                  ))}
                </select>
                <button 
                  onClick={handleLinkExisting}
                  disabled={!selectedLinkProductId || isSubmitting}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md font-bold disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Link & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl flex flex-col border border-border">
        
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
          
          <div className="grid grid-cols-3 gap-4 bg-secondary/20 p-4 rounded-lg border border-border">
            <div className="text-center border-r border-border">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Total Required</p>
              <p className="text-xl font-black text-foreground">{totalRequired}</p>
            </div>
            <div className="text-center border-r border-border">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Produced So Far</p>
              <p className="text-xl font-black text-blue-600">{producedSoFar}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Pending Balance</p>
              <p className="text-xl font-black text-red-600">{pendingBalance}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Completion Date</label>
              <input 
                type="date"
                required
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground">Completion Type</label>
              <div className="flex bg-secondary p-1 rounded-md">
                <button
                  type="button"
                  onClick={() => handleTypeChange('PART')}
                  className={cn(
                    "flex-1 text-xs font-bold py-1.5 rounded-sm transition-all",
                    completionType === 'PART' ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  PART (Incomplete)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('FINAL')}
                  className={cn(
                    "flex-1 text-xs font-bold py-1.5 rounded-sm transition-all",
                    completionType === 'FINAL' ? "bg-white text-green-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  FINAL (Complete)
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-sm font-bold text-foreground">
              Production Quantity <span className="text-destructive">*</span>
            </label>
            <input 
              type="number" 
              required
              min="1"
              value={productionQty}
              onChange={(e) => setProductionQty(e.target.value)}
              placeholder="Enter Quantity produced..."
              className="w-full text-xl font-bold rounded-md border border-input px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {completionType === 'FINAL' && Number(productionQty) !== pendingBalance && (
              <p className="text-xs text-orange-600 font-bold mt-1">
                Note: You are closing this Job Card with {productionQty || '0'} qty, but pending balance was {pendingBalance}.
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground">
              Rate (per unit) <span className="text-destructive">*</span>
            </label>
            <input 
              type="number" 
              required
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="Enter Rate..."
              className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="bg-blue-50 text-blue-900 text-xs p-3 rounded border border-blue-100 flex items-start mt-2">
            <CheckCircle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
            <p>
              This quantity will automatically be added to the <strong>Finish Goods Inventory</strong> under the <strong>REGULAR</strong> category for the selected date.
            </p>
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !productionQty || loadingProducts}
              className={cn(
                "px-6 py-2 text-sm font-bold rounded-md text-white transition-colors shadow flex items-center disabled:opacity-50",
                completionType === 'FINAL' ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isSubmitting && <CircleDashed className="w-4 h-4 mr-2 animate-spin" />}
              {completionType === 'FINAL' ? 'Complete Job Card' : 'Save Partial Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
