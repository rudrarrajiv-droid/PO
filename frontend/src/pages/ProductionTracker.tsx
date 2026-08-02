import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle2, AlertTriangle, AlertCircle, LayoutDashboard } from 'lucide-react';
import { queryDocuments } from '../lib/firebase/services';
import { cn } from '../lib/utils';
import CompleteProductionModal from './job-cards/CompleteProductionModal';
import ExportButtons from '../components/ExportButtons';

export default function ProductionTracker() {
  const [now, setNow] = useState(new Date());
  const [completingJobCard, setCompletingJobCard] = useState<any>(null);

  // Update clock every minute for dynamic delay calculation
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { data: jobCards = [], isLoading, refetch } = useQuery({
    queryKey: ['production-tracker'],
    queryFn: async () => {
      // Fetch both IN_PROCESS and COMPLETED
      const allCards = await queryDocuments('jobCards', []) as any[];
      return allCards.filter(jc => jc.status === 'IN_PROCESS' || jc.status === 'COMPLETED');
    },
    refetchInterval: 60000 // Refetch every minute automatically
  });

  const activeJobs = jobCards
    .filter(jc => jc.status === 'IN_PROCESS')
    .sort((a, b) => new Date(a.expectedDeliveryAt).getTime() - new Date(b.expectedDeliveryAt).getTime());

  const completedJobs = jobCards
    .filter(jc => jc.status === 'COMPLETED')
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

  // Delay calculation helper
  const getDelayInfo = (expectedAt: string) => {
    const expected = new Date(expectedAt);
    const diffMs = now.getTime() - expected.getTime();
    if (diffMs <= 0) return { isDelayed: false, text: 'On Track' };

    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHrs / 24);
    
    let text = '';
    if (diffDays > 0) text = `${diffDays}d ${diffHrs % 24}h delayed`;
    else text = `${diffHrs}h delayed`;

    return { isDelayed: true, text };
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading production tracker...</div>;
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full gap-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-primary" />
          Production Tracker
        </h1>
        <p className="text-muted-foreground mt-1">Live monitoring of active Job Cards on the production floor.</p>
      </div>

      {/* ACTIVE PRODUCTION */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center text-blue-800">
          <Clock className="w-5 h-5 mr-2" />
          Active Production ({activeJobs.length})
        </h2>
        
        {activeJobs.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-xl text-center text-muted-foreground bg-card">
            No active Job Cards in production.
          </div>
        ) : (
          <div className="grid gap-4">
            {activeJobs.map(jc => {
              const { isDelayed, text: delayText } = getDelayInfo(jc.expectedDeliveryAt);
              return (
                <div key={jc.id} className={cn(
                  "bg-card border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm transition-all hover:shadow-md",
                  isDelayed ? "border-red-300 bg-red-50/30" : "border-border"
                )}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-lg">{jc.jobCardNo}</span>
                      {isDelayed ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          DELAYED: {delayText}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          IN PROCESS
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-foreground mb-1">
                      {jc.customerName} - {jc.productName}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-4">
                      <span><strong className="text-foreground">Order Qty:</strong> {jc.orderQty}</span>
                      <span>
                        <strong className="text-foreground">Expected Delivery:</strong> {new Date(jc.expectedDeliveryAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 border-t md:border-t-0 pt-4 md:pt-0">
                    <button
                      onClick={() => setCompletingJobCard(jc)}
                      className="w-full md:w-auto px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow flex items-center justify-center transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Complete Job
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENTLY COMPLETED */}
      <div className="space-y-4 pt-8 border-t border-border">
        <h2 className="text-xl font-bold flex items-center text-green-800">
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Recently Completed ({completedJobs.length})
        </h2>
        
        {completedJobs.length === 0 ? (
          <div className="p-8 border border-dashed border-border rounded-xl text-center text-muted-foreground bg-card">
            No completed jobs yet.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="p-4 font-medium">Job Card</th>
                  <th className="p-4 font-medium">Customer & Product</th>
                  <th className="p-4 font-medium text-right">FG Qty</th>
                  <th className="p-4 font-medium text-right">Completed On</th>
                  <th className="p-4 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {completedJobs.map(jc => (
                  <tr key={jc.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-4 font-bold">{jc.jobCardNo}</td>
                    <td className="p-4">
                      <div className="font-medium">{jc.customerName}</div>
                      <div className="text-xs text-muted-foreground">{jc.productName}</div>
                    </td>
                    <td className="p-4 text-right font-bold text-green-700">{jc.fgQty || 0}</td>
                    <td className="p-4 text-right text-xs">
                      {jc.completedAt ? new Date(jc.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase",
                        jc.completionStatus === 'DELAYED' ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      )}>
                        {jc.completionStatus || 'COMPLETED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {completingJobCard && (
        <CompleteProductionModal 
          jobCard={completingJobCard}
          onClose={() => setCompletingJobCard(null)}
          onSuccess={() => {
            setCompletingJobCard(null);
            refetch();
          }}
        />
      )}

    </div>
  );
}
