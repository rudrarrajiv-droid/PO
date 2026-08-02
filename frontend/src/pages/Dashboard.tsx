import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, Clock, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { queryDocuments } from '../lib/firebase/services';
import DashboardListModal from './dashboard/DashboardListModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase/config';

export default function Dashboard() {
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; filterKey: string }>({
    isOpen: false,
    title: '',
    filterKey: ''
  });
  const [trendMode, setTrendMode] = useState<'weekly' | 'monthly'>('weekly');

  const { data: jobCards = [], isLoading: loadingJC } = useQuery({
    queryKey: ['dashboard-jobcards'],
    queryFn: async () => await queryDocuments('jobCards', []) as any[],
    refetchInterval: 10000
  });

  const { data: activityLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['dashboard-logs'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'activityLogs'));
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      return logs.sort((a, b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || a.createdAt?.toDate?.() || 0).getTime();
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || b.createdAt?.toDate?.() || 0).getTime();
        return timeB - timeA;
      }).slice(0, 50);
    },
    refetchInterval: 10000
  });

  const stats = useMemo(() => {
    const total = jobCards.length;
    const pending = jobCards.filter(jc => jc.status === 'PENDING');
    const inProcess = jobCards.filter(jc => jc.status === 'IN_PROCESS');
    const completed = jobCards.filter(jc => jc.status === 'COMPLETED');
    const delayed = jobCards.filter(jc => (jc.status === 'COMPLETED' && jc.completionStatus === 'DELAYED') || (jc.status === 'IN_PROCESS' && new Date(jc.expectedDeliveryAt) < new Date()));

    return {
      total,
      pending,
      inProcess,
      completed,
      delayed
    };
  }, [jobCards]);

  const openModal = (title: string, filterKey: string) => {
    if (filterKey === 'total') return; // Don't drill down into total orders for now
    setModalState({ isOpen: true, title, filterKey });
  };

  const getFilteredJobs = () => {
    switch (modalState.filterKey) {
      case 'pending': return stats.pending;
      case 'inProcess': return stats.inProcess;
      case 'completed': return stats.completed;
      case 'delayed': return stats.delayed;
      default: return [];
    }
  };

  // Chart 1: Production Output Trend
  const productionTrendData = useMemo(() => {
    const days = trendMode === 'weekly' ? 7 : 30;
    const pastDays = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return pastDays.map(dateStr => {
      const completedOnDate = stats.completed.filter(jc => {
        if (!jc.completedAt) return false;
        return jc.completedAt.startsWith(dateStr);
      }).length;
      
      const createdOnDate = jobCards.filter(jc => {
        const createdAt = jc.createdAt?.toDate?.()?.toISOString() || new Date(jc.date).toISOString();
        return createdAt.startsWith(dateStr);
      }).length;

      return {
        name: dateStr.substring(5), // e.g. "08-01"
        Completed: completedOnDate,
        Created: createdOnDate
      };
    });
  }, [stats.completed, jobCards, trendMode]);

  // Chart 2: On-Time vs Delayed
  const performanceData = useMemo(() => {
    const onTime = stats.completed.filter(jc => jc.completionStatus === 'ON TIME').length;
    const delayed = stats.completed.filter(jc => jc.completionStatus === 'DELAYED').length;
    
    if (onTime === 0 && delayed === 0) return []; // No data yet

    return [
      { name: 'On Time', value: onTime, color: '#16a34a' },
      { name: 'Delayed', value: delayed, color: '#dc2626' }
    ];
  }, [stats.completed]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Operational Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time overview of production metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {/* Total Orders Card */}
        <div className="p-6 bg-card border border-border shadow-sm rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Total Orders</h2>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Layers className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {loadingJC ? '...' : stats.total}
          </p>
        </div>

        {/* Pending Card */}
        <div 
          onClick={() => openModal('Pending', 'pending')}
          className="p-6 bg-card border border-border shadow-sm rounded-xl cursor-pointer hover:border-yellow-400 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Pending</h2>
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {loadingJC ? '...' : stats.pending.length}
          </p>
        </div>

        {/* In-Process Card */}
        <div 
          onClick={() => openModal('In Process', 'inProcess')}
          className="p-6 bg-card border border-border shadow-sm rounded-xl cursor-pointer hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">In-Process</h2>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {loadingJC ? '...' : stats.inProcess.length}
          </p>
        </div>

        {/* Completed Card */}
        <div 
          onClick={() => openModal('Completed', 'completed')}
          className="p-6 bg-card border border-border shadow-sm rounded-xl cursor-pointer hover:border-green-400 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Completed</h2>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {loadingJC ? '...' : stats.completed.length}
          </p>
        </div>

        {/* Delayed Card */}
        <div 
          onClick={() => openModal('Delayed', 'delayed')}
          className="p-6 bg-card border border-border shadow-sm rounded-xl cursor-pointer hover:border-red-400 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Delayed</h2>
            <div className="p-2 bg-red-500/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {loadingJC ? '...' : stats.delayed.length}
          </p>
        </div>
      </div>
      
      {/* Charts & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px]">
        
        {/* Main Chart */}
        <div className="bg-card border border-border shadow-sm rounded-xl p-6 flex flex-col lg:col-span-2">
           <div className="flex justify-between items-center mb-6">
             <h3 className="font-semibold text-foreground">Production Output Trend</h3>
             <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
               <button 
                 onClick={() => setTrendMode('weekly')}
                 className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", trendMode === 'weekly' ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
               >
                 Weekly
               </button>
               <button 
                 onClick={() => setTrendMode('monthly')}
                 className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", trendMode === 'monthly' ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
               >
                 Monthly
               </button>
             </div>
           </div>
           <div className="flex-1 w-full min-h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={productionTrendData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                 <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 <Bar dataKey="Created" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Activity Logs & Performance */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          
          {/* Performance Chart */}
          <div className="bg-card border border-border shadow-sm rounded-xl p-6 flex flex-col h-[220px]">
             <h3 className="font-semibold text-foreground mb-2 text-sm">Delivery Performance (Completed)</h3>
             {performanceData.length === 0 ? (
               <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">No completed jobs yet.</div>
             ) : (
               <div className="flex-1 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={performanceData}
                       cx="50%"
                       cy="50%"
                       innerRadius={40}
                       outerRadius={60}
                       paddingAngle={5}
                       dataKey="value"
                     >
                       {performanceData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Pie>
                     <Tooltip />
                     <Legend verticalAlign="bottom" height={36} iconType="circle" />
                   </PieChart>
                 </ResponsiveContainer>
               </div>
             )}
          </div>

          {/* Activity Feed */}
          <div className="bg-card border border-border shadow-sm rounded-xl p-6 flex flex-col flex-1 min-h-[250px] overflow-hidden">
             <h3 className="font-semibold text-foreground mb-4 text-sm flex items-center justify-between">
               Live Activity Feed
               {loadingLogs && <span className="text-xs text-muted-foreground animate-pulse">Syncing...</span>}
             </h3>
             <div className="flex-1 overflow-y-auto pr-2 space-y-4">
               {activityLogs.length > 0 ? (
                  activityLogs.map((log: any) => {
                   let ts = Date.now();
                   if (log.timestamp?.toDate) ts = log.timestamp.toDate().getTime();
                   else if (log.timestamp) ts = new Date(log.timestamp).getTime();
                   else if (log.createdAt?.toDate) ts = log.createdAt.toDate().getTime();

                   let displayAction = log.action;
                   if (displayAction === 'Updated') displayAction = 'Modified';
                   
                   return (
                     <div key={log.id} className="flex items-start text-sm pb-3 border-b border-border/50 last:border-0 last:pb-0">
                       <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0">
                         {log.user?.charAt(0).toUpperCase() || 'U'}
                       </div>
                       <div>
                         <p className="text-foreground leading-snug">
                           <span className="font-semibold">{log.user || 'System'}</span> {displayAction.toLowerCase()} <span className="font-medium text-primary">{log.entity === 'jobCards' ? 'Job Card' : log.entity}</span>
                         </p>
                         <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(ts, { addSuffix: true })}</p>
                       </div>
                     </div>
                   );
                 })
               ) : (
                 <p className="text-xs text-muted-foreground text-center py-4">No recent activities found.</p>
               )}
             </div>
          </div>

        </div>

      </div>

      {modalState.isOpen && (
        <DashboardListModal 
          title={modalState.title}
          jobCards={getFilteredJobs()}
          onClose={() => setModalState({ isOpen: false, title: '', filterKey: '' })}
        />
      )}
    </div>
  );
}
