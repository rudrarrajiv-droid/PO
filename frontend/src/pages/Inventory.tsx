import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { Plus, Search, Package, ArrowDownToLine, ArrowUpFromLine, CircleDashed, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { cn } from '../lib/utils';

export default function Inventory() {
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  const { data: reels = [], isLoading: loadingReels, refetch } = useQuery({
    queryKey: ['reels'],
    queryFn: async () => {
      const res = await api.get('/reels');
      return res.data;
    },
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reel Inventory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage paper reels and transactions</p>
        </div>
        <button 
          onClick={() => setIsTxModalOpen(true)}
          className="bg-primary text-primary-foreground px-4 py-2 flex items-center text-sm font-medium rounded-md shadow hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Transaction (IN/OUT)
        </button>
      </div>

      <div className="flex-1 bg-card border border-border shadow-sm rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search reels by No, Type, BF..." 
              className="pl-9 pr-4 py-2 w-full text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loadingReels ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border sticky top-0">
                <tr>
                  <th className="px-6 py-3 font-medium">Reel No</th>
                  <th className="px-6 py-3 font-medium">Paper Type</th>
                  <th className="px-6 py-3 font-medium">Size (in)</th>
                  <th className="px-6 py-3 font-medium">BF & GSM</th>
                  <th className="px-6 py-3 font-medium text-green-600">Total IN</th>
                  <th className="px-6 py-3 font-medium text-red-600">Total OUT</th>
                  <th className="px-6 py-3 font-medium">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reels.map((reel: any) => (
                  <tr key={reel.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">{reel.reelNo}</td>
                    <td className="px-6 py-4">{reel.paperType}</td>
                    <td className="px-6 py-4">{reel.size}"</td>
                    <td className="px-6 py-4">{reel.bf} BF | {reel.gsm} GSM</td>
                    <td className="px-6 py-4 text-green-600 font-medium">{reel.weightIn} Kg</td>
                    <td className="px-6 py-4 text-red-600 font-medium">{reel.weightOut} Kg</td>
                    <td className="px-6 py-4 font-bold">{reel.currentBalance} Kg</td>
                  </tr>
                ))}
                {reels.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto text-muted mb-3" />
                      <p>No inventory records found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isTxModalOpen && (
        <TransactionModal 
          onClose={() => setIsTxModalOpen(false)} 
          onSuccess={() => {
            setIsTxModalOpen(false);
            refetch();
          }} 
        />
      )}
    </div>
  );
}

function TransactionModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { type: 'IN' }
  });
  const txType = watch('type');

  const onSubmit = async (data: any) => {
    try {
      await api.post('/reels/transaction', {
        reelNo: data.reelNo,
        paperType: data.paperType,
        size: Number(data.size),
        bf: data.bf,
        gsm: Number(data.gsm),
        type: data.type,
        weight: Number(data.weight),
        remarks: data.remarks
      });
      onSuccess();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Transaction failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 overflow-auto">
      <div className="bg-card w-full max-w-2xl rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center">
            {txType === 'IN' ? (
              <ArrowDownToLine className="w-5 h-5 mr-2 text-green-500" />
            ) : (
              <ArrowUpFromLine className="w-5 h-5 mr-2 text-red-500" />
            )}
            New Reel Transaction
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <form id="tx-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex gap-4 mb-2">
                <label className={cn(
                  "flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors",
                  txType === 'IN' ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400" : "border-border text-muted-foreground hover:bg-muted"
                )}>
                  <input type="radio" value="IN" {...register('type')} className="sr-only" />
                  <ArrowDownToLine className="w-4 h-4 mr-2" /> REEL IN
                </label>
                <label className={cn(
                  "flex-1 flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors",
                  txType === 'OUT' ? "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400" : "border-border text-muted-foreground hover:bg-muted"
                )}>
                  <input type="radio" value="OUT" {...register('type')} className="sr-only" />
                  <ArrowUpFromLine className="w-4 h-4 mr-2" /> REEL OUT (ISSUE)
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Reel No.</label>
                <input {...register('reelNo', { required: true })} className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background" placeholder="e.g. R-101" />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Weight (Kg)</label>
                <input type="number" {...register('weight', { required: true, min: 1 })} className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background" placeholder="0" />
              </div>

              {/* If it's a new reel, we need specs. For simplicity in UI, we collect it always (backend ignores if reel exists) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Paper Type</label>
                <select {...register('paperType')} className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background">
                  <option value="Kraft">Kraft</option>
                  <option value="Semi-Kraft">Semi-Kraft</option>
                  <option value="Duplex">Duplex</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Size (inches)</label>
                <input type="number" step="0.1" {...register('size')} className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">BF</label>
                <input {...register('bf')} className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">GSM</label>
                <input type="number" {...register('gsm')} className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background" />
              </div>
              
              <div className="col-span-2 space-y-2 mt-2">
                <label className="text-sm font-medium">Remarks</label>
                <input {...register('remarks')} className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background" />
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3 bg-secondary/30 rounded-b-xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button type="submit" form="tx-form" disabled={isSubmitting} className="px-6 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center">
            {isSubmitting && <CircleDashed className="w-4 h-4 mr-2 animate-spin" />}
            Save Transaction
          </button>
        </div>
      </div>
    </div>
  );
}
