import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Clock, Activity, CheckCircle2, AlertCircle, Snowflake, Unlock, ShieldAlert, ShieldCheck, ShieldX, Printer, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DashboardListModal from './dashboard/DashboardListModal';
import PrintableJobCard from './job-cards/PrintableJobCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { getAttendanceByMonth } from '../lib/supabase/attendanceService';
import { getJobCards, getPendingApprovalJobCards, updateJobCard } from '../lib/supabase/jobCardService';
import { getFrozenReels, unfreezeReel, getOutwardReelTransactionsByMonth } from '../lib/supabase/reelService';
import { getRecentActivityLogs } from '../lib/supabase/activityLogService';

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [unfreezingId, setUnfreezingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [viewingJobCard, setViewingJobCard] = useState<any | null>(null);
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; filterKey: string }>({
    isOpen: false,
    title: '',
    filterKey: ''
  });
  const [trendMode, setTrendMode] = useState<'weekly' | 'monthly'>('weekly');

  const { data: jobCards = [], isLoading: loadingJC } = useQuery({
    queryKey: ['dashboard-jobcards'],
    queryFn: () => getJobCards() as Promise<any[]>,
    refetchInterval: 10000
  });

  const { data: activityLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['dashboard-logs'],
    queryFn: () => getRecentActivityLogs(50),
    refetchInterval: 10000
  });

  const currentMonth = new Date().toISOString().substring(0, 7);
  const { data: attendance = [] } = useQuery({
    queryKey: ['dashboard-attendance', currentMonth],
    queryFn: () => getAttendanceByMonth(currentMonth)
  });
  const { data: outwardReels = [] } = useQuery({
    queryKey: ['dashboard-outward', currentMonth],
    queryFn: () => getOutwardReelTransactionsByMonth(currentMonth)
  });

  const { data: frozenReels = [], isLoading: loadingFrozen, refetch: refetchFrozen } = useQuery({
    queryKey: ['dashboard-frozen-reels'],
    queryFn: () => getFrozenReels() as Promise<any[]>,
    refetchInterval: 10000,
    enabled: hasRole('ADMIN')
  });

  // Phase 3: Pending Approvals query
  const { data: pendingApprovals = [], refetch: refetchApprovals } = useQuery({
    queryKey: ['dashboard-pending-approvals'],
    queryFn: async () => {
      const now = Date.now();
      const cards = await getPendingApprovalJobCards();
      return cards
        .filter(jc => {
          // Auto-expire check: skip expired ones
          if (jc.approvalExpiresAt && new Date(jc.approvalExpiresAt).getTime() < now) {
            // Fire-and-forget auto-expiry
            void updateJobCard(jc.id, {
              status: 'CANCELLED',
              approvalStatus: 'EXPIRED',
            }, 'System', { log: false, touchUpdatedBy: false }).catch((error) => {
              console.error('Failed to auto-expire approval:', error);
            });
            return false;
          }
          return true;
        });
    },
    refetchInterval: 10000,
    enabled: hasRole('ADMIN')
  });

  const handleUnfreeze = async (reelId: string) => {
    try {
      setUnfreezingId(reelId);
      await unfreezeReel(reelId, user?.name || 'System');
      refetchFrozen();
    } catch (err: any) {
      alert('Failed to unfreeze: ' + err.message);
    } finally {
      setUnfreezingId(null);
    }
  };

  // Phase 3: Approve or Reject oversize approval request
  const handleApprovalAction = async (jcId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      setApprovingId(jcId + action);
      const newStatus = action === 'APPROVED' ? 'PENDING' : 'CANCELLED';
      await updateJobCard(jcId, {
        status: newStatus,
        approvalStatus: action,
        approvalReviewedAt: new Date().toISOString(),
      }, 'System', { log: false, touchUpdatedBy: false });
      refetchApprovals();
      queryClient.invalidateQueries({ queryKey: ['dashboard-jobcards'] });
    } catch (err: any) {
      alert('Failed to process: ' + err.message);
    } finally {
      setApprovingId(null);
    }
  };

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

  // Chart 1: Conversion Cost Trend
  const conversionTrendData = useMemo(() => {
    const days = trendMode === 'weekly' ? 7 : 30;
    const pastDays = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return pastDays.map(dateStr => {
      const dailyAtt = attendance.filter(a => a.date === dateStr);
      const dailyTx = outwardReels.filter(tx => tx.date && tx.date.startsWith(dateStr));
      
      const manpower = dailyAtt.reduce((acc, rec) => acc + (rec.perDayAmount || 0) + (rec.otAmount || 0) + (rec.refreshment || 0), 0);
      const weight = dailyTx.reduce((acc, tx) => acc + (tx.quantity || 0), 0);
      
      return {
        name: dateStr.substring(5), // MM-DD
        Cost: weight > 0 ? Number((manpower / weight).toFixed(2)) : 0
      };
    });
  }, [attendance, outwardReels, trendMode]);

  const currentConversionCost = useMemo(() => {
    const totalManpowerCost = attendance.reduce((acc, rec) => acc + (rec.perDayAmount || 0) + (rec.otAmount || 0) + (rec.refreshment || 0), 0);
    const totalWeight = outwardReels.reduce((acc, tx) => acc + (tx.quantity || 0), 0);
    return totalWeight > 0 ? (totalManpowerCost / totalWeight).toFixed(2) : '0.00';
  }, [attendance, outwardReels]);

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

      {hasRole('ADMIN') && frozenReels.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center">
            <Snowflake className="w-5 h-5 mr-2 text-blue-500" />
            Frozen Reels (Reserved for Active/Pending Job Cards)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {frozenReels.map((reel: any) => (
              <div key={reel.id} className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden">
                <div className="absolute -right-4 -top-4 text-blue-100/50 pointer-events-none">
                   <Snowflake className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase">Reel No</p>
                      <p className="font-bold text-blue-900">{reel.reelNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-muted-foreground uppercase">Weight</p>
                      <p className="font-bold text-foreground">{reel.currentBalance} Kg</p>
                    </div>
                  </div>
                  <p className="text-xs mb-3">
                    Reserved For JC: <span className="font-semibold text-primary">{jobCards.find((jc: any) => jc.id === reel.reservedForJC)?.jobCardNo || reel.reservedForJC}</span>
                  </p>
                  <button 
                    onClick={() => handleUnfreeze(reel.id)}
                    disabled={unfreezingId === reel.id}
                    className="w-full flex items-center justify-center text-xs font-bold bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors py-2 rounded-md"
                  >
                    {unfreezingId === reel.id ? 'Unfreezing...' : <><Unlock className="w-3 h-3 mr-1.5" /> Force Unfreeze</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 3: Pending Approvals Widget (Admin Only) */}
      {hasRole('ADMIN') && pendingApprovals.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center">
            <ShieldAlert className="w-5 h-5 mr-2 text-orange-500" />
            Pending Approvals — Oversize Reel Requests
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">{pendingApprovals.length}</span>
          </h2>
          <div className="flex flex-col gap-3">
            {pendingApprovals.map((jc: any) => {
              const requestedAt = jc.approvalRequestedAt ? new Date(jc.approvalRequestedAt) : null;
              const expiresAt = jc.approvalExpiresAt ? new Date(jc.approvalExpiresAt) : null;
              const hoursLeft = expiresAt ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000)) : null;
              return (
                <div key={jc.id} className="bg-orange-50/60 border border-orange-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-foreground text-sm">JC #{jc.jobCardNo}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">Oversize</span>
                    </div>
                    <p className="text-sm text-foreground font-medium truncate">{jc.productSnapshot?.productName || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Requested by: <span className="font-semibold text-foreground">{jc.approvalRequestedBy || 'Unknown'}</span>
                      {requestedAt && <> · {formatDistanceToNow(requestedAt, { addSuffix: true })}</>}
                    </p>
                    <div className="mt-2 bg-white border border-orange-100 rounded-lg p-2.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Reason Given:</p>
                      <p className="text-sm text-foreground">{jc.approvalReason}</p>
                    </div>
                    {hoursLeft !== null && (
                      <p className={cn("text-xs mt-2 font-semibold", hoursLeft < 6 ? "text-red-600" : "text-orange-600")}>
                        ⏱ Expires in: {hoursLeft}h
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setViewingJobCard(jc)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      View
                    </button>
                    <button
                      onClick={() => handleApprovalAction(jc.id, 'REJECTED')}
                      disabled={approvingId === jc.id + 'REJECTED'}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-white border border-red-200 text-red-700 hover:bg-red-600 hover:text-white transition-colors"
                    >
                      <ShieldX className="w-4 h-4" />
                      {approvingId === jc.id + 'REJECTED' ? '...' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleApprovalAction(jc.id, 'APPROVED')}
                      disabled={approvingId === jc.id + 'APPROVED'}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {approvingId === jc.id + 'APPROVED' ? '...' : 'Approve'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Charts & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-[400px]">
        
        {/* Main Chart */}
        <div className="bg-card border border-border shadow-sm rounded-xl p-6 flex flex-col lg:col-span-2">
           <div className="flex justify-between items-center mb-6">
             <div>
               <h3 className="font-semibold text-foreground">Conversion Cost Trend</h3>
               <p className="text-xs text-muted-foreground mt-1">Current MTD Avg: <span className="font-bold text-red-600">₹{currentConversionCost} / kg</span></p>
             </div>
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
               <AreaChart data={conversionTrendData}>
                 <defs>
                   <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `₹${val}`} />
                 <Tooltip 
                   cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '3 3' }} 
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                   formatter={(value: any) => [`₹${value}`, 'Cost/Kg']}
                 />
                 <Area type="monotone" dataKey="Cost" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
               </AreaChart>
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

      {viewingJobCard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">View Job Card</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const printContent = document.getElementById('print-job-card');
                    if (printContent) {
                      const printWindow = window.open('', '', 'width=900,height=600');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Print Job Card - ${viewingJobCard.jobCardNo}</title>
                              <script src="https://cdn.tailwindcss.com"></script>
                            </head>
                            <body class="bg-white p-8">
                              ${printContent.innerHTML}
                              <script>
                                setTimeout(() => {
                                  window.print();
                                  window.close();
                                }, 500);
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }
                  }}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </button>
                <button
                  onClick={() => setViewingJobCard(null)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-100" id="print-job-card">
              <PrintableJobCard jobCard={viewingJobCard} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
