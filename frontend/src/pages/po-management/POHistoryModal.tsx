import React, { useState, useMemo } from 'react';
import { X, History, AlertTriangle, Search, Activity, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { queryDocuments, type PurchaseOrder } from '../../lib/firebase/services';

interface POHistoryModalProps {
  po: PurchaseOrder;
  onClose: () => void;
}

export default function POHistoryModal({ po, onClose }: POHistoryModalProps) {
  // Fetch transactions for this PO
  const { data: transactions = [], isLoading } = useQuery<any[]>({
    queryKey: ['poTransactions', po.id],
    queryFn: () => queryDocuments('poTransactions', [where('poId', '==', po.id)]) as Promise<any[]>
  });

  // Client-Side Filters
  const [filterType, setFilterType] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // 1. Sort Chronologically (Oldest to Newest)
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions]);

  // 2. Calculate Running Balance and check mismatch
  const { historyData, calculatedBalance, totalIn, totalOut } = useMemo(() => {
    let currentBalance = po.orderQty;
    let tIn = 0;
    let tOut = 0;
    
    const enrichedData = sortedTransactions.map(tx => {
      if (tx.type === 'IN') {
        currentBalance += tx.quantity;
        tIn += tx.quantity;
      } else if (tx.type === 'OUT') {
        currentBalance -= tx.quantity;
        tOut += tx.quantity;
      }
      return { ...tx, runningBalance: currentBalance };
    });

    return { 
      historyData: enrichedData, 
      calculatedBalance: currentBalance,
      totalIn: tIn,
      totalOut: tOut
    };
  }, [sortedTransactions, po.orderQty]);

  // 3. Current System Balance
  const systemClosingBal = po.orderQty + (po.inQty || 0) - (po.outQty || 0);
  const isMismatch = calculatedBalance !== systemClosingBal;

  // 4. Apply Filters for Display Only
  const displayData = useMemo(() => {
    return historyData.filter(tx => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo && tx.date > dateTo) return false;
      return true;
    });
  }, [historyData, filterType, dateFrom, dateTo]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-card w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col h-[90vh] border border-border overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-blue-500/10 to-transparent flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center">
              <History className="w-6 h-6 mr-3 text-blue-500" />
              PO Transaction History
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Read-only transaction log for PO {po.poNo}</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
          
          {/* Mismatch Warning */}
          {isMismatch && !isLoading && (
            <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm font-semibold flex items-start animate-shake">
              <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="text-base font-bold">History balance mismatch detected.</p>
                <p className="mt-1 font-medium opacity-90">The calculated running balance from history ({calculatedBalance}) does not match the stored PO closing balance ({systemClosingBal}). Data remains unmodified.</p>
              </div>
            </div>
          )}

          {/* PO Header (Read Only) */}
          <div className="mb-6 p-5 bg-card rounded-xl border border-border shadow-sm">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">PO Master Data</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-4 gap-x-6">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">PO No.</p>
                <p className="font-bold text-foreground text-sm">{po.poNo}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">PO Date</p>
                <p className="font-semibold text-foreground text-sm">{new Date(po.poDate).toLocaleDateString('en-GB')}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Delivery Date</p>
                <p className="font-semibold text-foreground text-sm">{new Date(po.deliveryDate).toLocaleDateString('en-GB')}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Customer</p>
                <p className="font-bold text-foreground text-sm truncate" title={po.customerName}>{po.customerName}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Consignee</p>
                <p className="font-semibold text-foreground text-sm truncate" title={po.consignee}>{po.consignee || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Artwork No.</p>
                <p className="font-mono text-foreground text-sm">{po.artworkNo || '-'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-[10px] text-muted-foreground uppercase">Item Name</p>
                <p className="font-bold text-foreground text-sm truncate" title={po.productName}>{po.productName}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Size</p>
                <p className="font-semibold text-foreground text-sm">{po.size}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Rate</p>
                <p className="font-bold text-foreground text-sm">₹{po.rate.toFixed(2)}</p>
              </div>
            </div>

            {/* Read-Only Summary */}
            <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-border bg-muted/30 -mx-5 -mb-5 p-5 rounded-b-xl">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Opening Qty</p>
                <p className="font-black text-foreground text-xl">{po.orderQty}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total IN</p>
                <p className="font-black text-green-600 text-xl">{totalIn}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total OUT</p>
                <p className="font-black text-blue-600 text-xl">{totalOut}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Current Closing Bal</p>
                <p className={`font-black text-xl ${isMismatch ? 'text-red-600' : 'text-foreground'}`}>{calculatedBalance}</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-4 items-end bg-card p-4 rounded-xl border border-border shadow-sm">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Type</label>
              <select 
                className="px-3 py-2 text-sm rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="ALL">All Transactions</option>
                <option value="IN">IN Only</option>
                <option value="OUT">OUT Only</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Date From</label>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)} 
                className="px-3 py-2 text-sm rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Date To</label>
              <input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)} 
                className="px-3 py-2 text-sm rounded border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" 
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm relative min-h-[300px]">
            {isLoading && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="flex flex-col items-center text-primary">
                  <Activity className="w-8 h-8 animate-spin mb-2" />
                  <span className="font-semibold">Loading History...</span>
                </div>
              </div>
            )}
            
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-secondary/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-3 border-b border-border">Date</th>
                  <th className="px-4 py-3 border-b border-border text-center">Type</th>
                  <th className="px-4 py-3 border-b border-border text-right">Quantity</th>
                  <th className="px-4 py-3 border-b border-border text-right">Running Balance</th>
                  <th className="px-4 py-3 border-b border-border">User</th>
                  <th className="px-4 py-3 border-b border-border w-full">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayData.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <FileText className="w-10 h-10 mb-3 text-muted-foreground/30" />
                        <p className="text-base font-semibold">No IN/OUT transactions recorded for this PO.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayData.map((tx, idx) => (
                    <tr key={tx.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-medium">{new Date(tx.date).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                          tx.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${tx.type === 'IN' ? 'text-green-600' : 'text-blue-600'}`}>
                        {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-foreground">{tx.runningBalance}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-semibold">{tx.performedBy || 'System'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-normal max-w-[300px]">
                        {tx.remarks || <span className="opacity-40 italic">No remarks</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
