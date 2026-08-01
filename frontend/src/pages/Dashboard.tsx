import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '../lib/api';
import { Layers, Clock, Activity, CheckCircle2 } from 'lucide-react';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 5000 // Real-time feel
  });

  return (
    <div className="h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Executive Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time overview of production metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Orders Card */}
        <div className="p-6 bg-card border border-border shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Total Orders</h2>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Layers className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {isLoading ? '...' : stats?.totalOrders || 0}
          </p>
        </div>

        {/* Pending Card */}
        <div className="p-6 bg-card border border-border shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Pending</h2>
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {isLoading ? '...' : stats?.pending || 0}
          </p>
        </div>

        {/* In-Process Card */}
        <div className="p-6 bg-card border border-border shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">In-Process</h2>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {isLoading ? '...' : stats?.inProcess || 0}
          </p>
        </div>

        {/* Completed Card */}
        <div className="p-6 bg-card border border-border shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Completed</h2>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-4xl font-bold text-foreground">
            {isLoading ? '...' : stats?.completed || 0}
          </p>
        </div>
      </div>
      
      {/* Placeholder for future charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="bg-card border border-border shadow-sm rounded-xl p-6 flex flex-col justify-center items-center text-muted-foreground">
           <p className="font-medium mb-2">Production Output Chart</p>
           <p className="text-xs">Data visualization will appear here once more production logs are recorded.</p>
        </div>
        <div className="bg-card border border-border shadow-sm rounded-xl p-6 flex flex-col justify-start">
           <h3 className="font-semibold text-foreground mb-4">Recent Activities</h3>
           <div className="space-y-4">
             {stats?.recentActivities?.length > 0 ? (
               stats.recentActivities.map((log: any) => (
                 <div key={log.id} className="flex items-start text-sm">
                   <div className="w-2 h-2 mt-1.5 rounded-full bg-primary mr-3 flex-shrink-0" />
                   <div>
                     <p className="text-foreground"><span className="font-medium">{log.user.name}</span> performed <span className="font-mono text-xs bg-muted px-1 rounded">{log.action}</span> on {log.entity} #{log.entityId}</p>
                     <p className="text-xs text-muted-foreground mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>
                   </div>
                 </div>
               ))
             ) : (
               <p className="text-xs text-muted-foreground text-center py-4">No recent activities found.</p>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
