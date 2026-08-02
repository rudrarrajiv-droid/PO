import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJobCards, getProductionLogs, addProductionLog } from '../lib/api';
import { Activity, Plus, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { cn } from '../lib/utils';

const DEPARTMENTS = [
  'Corrugation Deptt',
  'Paper Cutting',
  'Pasting',
  'Rotary',
  'RS4',
  'Finish Goods'
];

export default function Production() {
  const [selectedJobCardId, setSelectedJobCardId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: jobCards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['jobcards'],
    queryFn: getJobCards,
  });

  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['productionLogs', selectedJobCardId],
    queryFn: () => getProductionLogs(selectedJobCardId!),
    enabled: !!selectedJobCardId,
  });

  const selectedJobCard = jobCards.find((jc: any) => jc.id === selectedJobCardId);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const onSubmit = async (data: any) => {
    try {
      await addProductionLog({
        jobCardId: selectedJobCardId,
        department: data.department,
        productionQty: Number(data.productionQty),
        operatorName: data.operatorName,
        supervisorSign: data.supervisorSign
      });
      reset();
      qc.invalidateQueries({ queryKey: ['productionLogs', selectedJobCardId] });
      // We might want to invalidate jobcards if we update jobcard status based on finish goods
    } catch (err) {
      console.error(err);
      alert('Failed to add production log');
    }
  };

  const totalProduced = logs
    .filter((l: any) => l.department === 'Finish Goods')
    .reduce((sum: number, l: any) => sum + l.productionQty, 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <Activity className="w-6 h-6 mr-3 text-primary" />
            Production Tracker
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Track production progress across departments</p>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Left Side: Job Card List */}
        <div className="w-1/3 bg-card border border-border shadow-sm rounded-lg flex flex-col">
          <div className="p-4 border-b border-border font-semibold text-foreground">
            Select Job Card
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loadingCards ? (
              <p className="text-center text-muted-foreground p-4 text-sm">Loading job cards...</p>
            ) : jobCards.map((jc: any) => (
              <button
                key={jc.id}
                onClick={() => setSelectedJobCardId(jc.id)}
                className={cn(
                  "w-full text-left p-3 rounded-md transition-colors flex items-center justify-between border",
                  selectedJobCardId === jc.id 
                    ? "bg-primary/10 border-primary text-primary" 
                    : "bg-background border-border hover:border-primary/50 text-foreground"
                )}
              >
                <div>
                  <div className="font-bold">{jc.jobCardNo}</div>
                  <div className="text-xs opacity-80 mt-1">{jc.product?.itemName} - {jc.orderQty} Qty</div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Tracking Details */}
        <div className="w-2/3 bg-card border border-border shadow-sm rounded-lg flex flex-col">
          {selectedJobCard ? (
            <>
              {/* Header Info */}
              <div className="p-5 border-b border-border bg-secondary/20">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selectedJobCard.jobCardNo}</h2>
                    <p className="text-sm text-muted-foreground">{selectedJobCard.product?.itemName} • Customer: {selectedJobCard.product?.customer?.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">Order Qty: {selectedJobCard.orderQty}</div>
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">Produced (FG): {totalProduced}</div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs mb-1 font-medium">
                    <span>Progress</span>
                    <span>{Math.round((totalProduced / selectedJobCard.orderQty) * 100)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all" 
                      style={{ width: `${Math.min((totalProduced / selectedJobCard.orderQty) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Add Log Form */}
              <div className="p-5 border-b border-border">
                <h3 className="text-sm font-semibold mb-3">Add Tracking Log</h3>
                <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-5 gap-3 items-end">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-medium">Department <span className="text-destructive">*</span></label>
                    <select {...register('department', { required: true })} className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="">Select...</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Qty <span className="text-destructive">*</span></label>
                    <input type="number" {...register('productionQty', { required: true })} className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background" placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Operator</label>
                    <input type="text" {...register('operatorName')} className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background" placeholder="Name" />
                  </div>
                  <button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-medium rounded-md hover:bg-primary/90 flex items-center justify-center">
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </button>
                </form>
              </div>

              {/* Logs History */}
              <div className="flex-1 p-5 overflow-y-auto">
                <h3 className="text-sm font-semibold mb-3">Tracking History</h3>
                {loadingLogs ? (
                  <p className="text-sm text-muted-foreground">Loading history...</p>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No production logs found for this Job Card.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log: any) => (
                      <div key={log.id} className="flex justify-between items-center p-3 border border-border rounded-lg bg-secondary/10">
                        <div>
                          <div className="font-semibold text-sm">{log.department}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(log.recordedAt).toLocaleString()} • Operator: {log.operatorName || 'N/A'}
                          </div>
                        </div>
                        <div className="font-bold text-primary bg-primary/10 px-3 py-1 rounded-md">
                          +{log.productionQty}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Activity className="w-12 h-12 mb-3 opacity-20" />
              <p>Select a Job Card from the left to view and add tracking logs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
