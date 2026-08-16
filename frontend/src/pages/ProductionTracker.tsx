import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle2, AlertTriangle, LayoutDashboard, MessageSquarePlus, Activity, CalendarClock } from 'lucide-react';
import { getJobCards } from '../lib/supabase/jobCardService';
import { cn } from '../lib/utils';
import CompleteProductionModal from './job-cards/CompleteProductionModal';
import AddRemarkModal from './job-cards/AddRemarkModal';
import ExportButtons from '../components/ExportButtons';

export default function ProductionTracker() {
  const [now, setNow] = useState(new Date());
  const [completingJobCard, setCompletingJobCard] = useState<any>(null);
  const [addingRemarkJob, setAddingRemarkJob] = useState<any>(null);

  // Update clock every minute for dynamic delay calculation
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { data: jobCards = [], isLoading, refetch } = useQuery({
    queryKey: ['production-tracker'],
    queryFn: async () => {
      const allCards = await getJobCards({ statuses: ['IN_PROCESS', 'COMPLETED'] }) as any[];
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

  const delayedCount = activeJobs.filter(jc => getDelayInfo(jc.expectedDeliveryAt).isDelayed).length;
  const onTimeCount = activeJobs.length - delayedCount;

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full gap-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-primary" />
          Production Tracker
        </h1>
        <p className="text-muted-foreground mt-1">Live monitoring of active Job Cards on the production floor.</p>
      </div>

      {/* DASHBOARD METRICS */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50/50 border border-red-100 rounded-xl p-5 flex items-center shadow-sm">
          <div className="bg-red-100 text-red-600 p-3 rounded-lg mr-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-red-800 tracking-wider">TOTAL DELAYED JOBS</div>
            <div className="text-3xl font-black text-red-600">{delayedCount}</div>
          </div>
        </div>
        <div className="bg-green-50/50 border border-green-100 rounded-xl p-5 flex items-center shadow-sm">
          <div className="bg-green-100 text-green-600 p-3 rounded-lg mr-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-green-800 tracking-wider">TOTAL ON-TIME JOBS</div>
            <div className="text-3xl font-black text-green-600">{onTimeCount}</div>
          </div>
        </div>
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
                <div key={jc.id} className="flex flex-col gap-2">
                  <div className={cn(
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
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
                        <span><strong className="text-foreground">Order Qty:</strong> {jc.orderQty}</span>
                        <span className="flex items-center text-blue-700">
                          <Activity className="w-3.5 h-3.5 mr-1" />
                          <strong className="text-foreground mr-1">Issued:</strong> {jc.issuedAt ? new Date(jc.issuedAt).toLocaleString([], { dateStyle: 'medium' }) : '-'}
                        </span>
                        <span className="flex items-center text-orange-700">
                          <CalendarClock className="w-3.5 h-3.5 mr-1" />
                          <strong className="text-foreground mr-1">Expected:</strong> {new Date(jc.expectedDeliveryAt).toLocaleString([], { dateStyle: 'medium' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 border-t md:border-t-0 pt-4 md:pt-0">
                      <button
                        onClick={() => setAddingRemarkJob(jc)}
                        className="w-full md:w-auto px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold rounded-lg shadow-sm flex items-center justify-center transition-colors border border-border"
                      >
                        <MessageSquarePlus className="w-4 h-4 mr-2 text-primary" />
                        Add Remark
                      </button>
                      <button
                        onClick={() => setCompletingJobCard(jc)}
                        className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm flex items-center justify-center transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Complete Job
                      </button>
                    </div>
                  </div>

                  {/* Remarks Timeline */}
                  {jc.remarks && jc.remarks.length > 0 && (
                    <div className="bg-secondary/10 border border-border rounded-xl p-4 ml-8 relative before:absolute before:inset-0 before:ml-4 before:h-full before:w-0.5 before:bg-border">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 pl-8">Production Timeline</h4>
                      <div className="space-y-4">
                        {jc.remarks.map((rmk: any, idx: number) => (
                          <div key={idx} className="relative pl-8">
                            <div className="absolute left-[9px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background z-10" />
                            <div className="bg-card border border-border rounded-md p-3 shadow-sm inline-block min-w-[250px] max-w-full">
                              <div className="text-sm font-medium text-foreground">{rmk.text}</div>
                              <div className="text-[10px] text-muted-foreground mt-1.5 flex justify-between gap-4">
                                <span>{new Date(rmk.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                <span className="font-semibold">{rmk.by}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

      {addingRemarkJob && (
        <AddRemarkModal 
          jobCard={addingRemarkJob}
          onClose={() => setAddingRemarkJob(null)}
          onSuccess={() => {
            setAddingRemarkJob(null);
            refetch();
          }}
        />
      )}

    </div>
  );
}
