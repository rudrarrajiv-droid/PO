import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageCheck, Search, ArrowDownToLine, ArrowUpFromLine, FileText, History, CircleDollarSign } from 'lucide-react';
import { queryDocuments } from '../lib/firebase/services';
import ExportButtons from '../components/ExportButtons';
import BulkInModal from './finish-goods/BulkInModal';
import BulkOutModal from './finish-goods/BulkOutModal';
import FinishGoodHistoryModal from './finish-goods/FinishGoodHistoryModal';

export default function FinishGoods() {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'REGULAR' | 'NON-MOVING'>('ALL');
  const [isBulkInOpen, setIsBulkInOpen] = useState(false);
  const [isBulkOutOpen, setIsBulkOutOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { data: fgList = [], isLoading, refetch } = useQuery({
    queryKey: ['finishGoods'],
    queryFn: () => queryDocuments('finishGoods', []) as Promise<any[]>
  });

  const filteredFG = useMemo(() => {
    return fgList.filter((item: any) => {
      const searchString = `${item.productName} ${item.customerName}`.toLowerCase();
      if (!searchString.includes(search.toLowerCase())) return false;
      
      const aReg = Number(item.closingBalance) || 0;
      const aNon = Number(item.nonMovingBalance) || 0;

      if (stockFilter === 'REGULAR' && aReg === 0) return false;
      if (stockFilter === 'NON-MOVING' && aNon === 0) return false;

      return true;
    }).sort((a: any, b: any) => {
      const aReg = Number(a.closingBalance) || 0;
      const bReg = Number(b.closingBalance) || 0;
      const aNon = Number(a.nonMovingBalance) || 0;
      const bNon = Number(b.nonMovingBalance) || 0;

      const aHasReg = aReg > 0;
      const bHasReg = bReg > 0;

      if (aHasReg && !bHasReg) return -1;
      if (!aHasReg && bHasReg) return 1;

      if (!aHasReg && !bHasReg) {
        const aHasNon = aNon > 0;
        const bHasNon = bNon > 0;
        if (aHasNon && !bHasNon) return -1;
        if (!aHasNon && bHasNon) return 1;
      }

      // Default sort by customer name then product name
      const custCompare = (a.customerName || '').localeCompare(b.customerName || '');
      if (custCompare !== 0) return custCompare;
      return (a.productName || '').localeCompare(b.productName || '');
    });
  }, [fgList, search, stockFilter]);

  const { totalRegValue, totalNonValue } = useMemo(() => {
    return filteredFG.reduce((acc: any, curr: any) => {
      const rate = Number(curr.rate) || 0;
      const regBal = Number(curr.closingBalance) || 0;
      const nonBal = Number(curr.nonMovingBalance) || 0;
      
      return {
        totalRegValue: acc.totalRegValue + (regBal * rate),
        totalNonValue: acc.totalNonValue + (nonBal * rate)
      };
    }, { totalRegValue: 0, totalNonValue: 0 });
  }, [filteredFG]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-4 p-4 md:p-6 max-w-7xl mx-auto w-full">
      {/* Header & Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center">
            <PackageCheck className="w-8 h-8 mr-3 text-primary" />
            Finish Goods Inventory
          </h1>
          <p className="text-muted-foreground mt-1">Manage finished products and dispatch</p>
        </div>
        
        <div className="flex gap-4 items-stretch justify-end">
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex-1 max-w-[200px] flex flex-col justify-center items-end">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Total Regular Value</div>
            <div className="text-xl font-black text-primary">₹{totalRegValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex-1 max-w-[200px] flex flex-col justify-center items-end">
            <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">Total Non-Moving Value</div>
            <div className="text-xl font-black text-orange-600">₹{totalNonValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm shrink-0">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by customer or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          
          <select 
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          >
            <option value="ALL">All Items</option>
            <option value="REGULAR">Regular Stock Only</option>
            <option value="NON-MOVING">Non-Moving Only</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto pb-2 sm:pb-0">
          <ExportButtons 
            data={filteredFG} 
            filenamePrefix="FinishGoodsInventory"
            title="Finish Goods Inventory Status"
            columnMap={{
              'customerName': 'Customer',
              'productName': 'Product',
              'openingQty': 'Opening Qty',
              'inQty': 'IN',
              'outQty': 'OUT',
              'closingBalance': 'Closing Balance',
              'rate': 'Rate',
            }}
          />
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="bg-secondary text-secondary-foreground border border-border px-4 py-2 flex items-center text-sm font-medium rounded-md shadow-sm hover:bg-secondary/80 transition-colors"
          >
            <History className="w-4 h-4 mr-2" />
            Product History
          </button>
          
          <button 
            onClick={() => setIsBulkOutOpen(true)}
            className="bg-red-600 text-white px-4 py-2 flex items-center text-sm font-medium rounded-md shadow hover:bg-red-700 transition-colors"
          >
            <ArrowUpFromLine className="w-4 h-4 mr-2" />
            Bulk OUT
          </button>
          
          <button 
            onClick={() => setIsBulkInOpen(true)}
            className="bg-green-600 text-white px-4 py-2 flex items-center text-sm font-medium rounded-md shadow hover:bg-green-700 transition-colors"
          >
            <ArrowDownToLine className="w-4 h-4 mr-2" />
            Bulk IN
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-card border border-border shadow-sm rounded-lg overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading inventory records...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-medium">Customer Name</th>
                  <th className="px-6 py-4 font-medium">Product / Artwork Name</th>
                  <th className="px-6 py-4 font-medium text-right">Opening Qty</th>
                  <th className="px-6 py-4 font-medium text-right text-green-600">IN</th>
                  <th className="px-6 py-4 font-medium text-right text-red-600">OUT</th>
                  <th className="px-6 py-4 font-medium text-right text-blue-600">Regular Balance</th>
                  <th className="px-6 py-4 font-medium text-right text-orange-600">Non-Moving</th>
                  <th className="px-6 py-4 font-medium text-right">Rate</th>
                  <th className="px-6 py-4 font-medium text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFG.map((item: any) => {
                  const closingBal = Number(item.closingBalance) || 0;
                  const nonMovingBal = Number(item.nonMovingBalance) || 0;
                  const rate = Number(item.rate) || 0;
                  const totalVal = (closingBal + nonMovingBal) * rate;
                  
                  return (
                    <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{item.customerName}</td>
                      <td className="px-6 py-4 font-medium text-muted-foreground">{item.productName}</td>
                      <td className="px-6 py-4 text-right font-medium">{item.openingQty || 0}</td>
                      <td className="px-6 py-4 text-right font-bold text-green-600">{item.inQty || 0}</td>
                      <td className="px-6 py-4 text-right font-bold text-red-600">{item.outQty || 0}</td>
                      <td className="px-6 py-4 text-right font-black text-blue-700 text-base">{closingBal}</td>
                      <td className="px-6 py-4 text-right font-bold text-orange-600">{nonMovingBal}</td>
                      <td className="px-6 py-4 text-right font-medium text-muted-foreground">₹{rate.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">₹{totalVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
                {filteredFG.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto text-muted mb-3 opacity-20" />
                      <p>No finished goods found. Use Bulk IN to add stock.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground flex justify-between">
          <span>Showing {filteredFG.length} records</span>
          <span>Only Finished Goods are shown here. Total Value calculates only Regular stock.</span>
        </div>
      </div>
      
      {isBulkInOpen && (
        <BulkInModal 
          onClose={() => setIsBulkInOpen(false)}
          onSuccess={() => {
            setIsBulkInOpen(false);
            refetch();
          }}
        />
      )}
      {isBulkOutOpen && (
        <BulkOutModal 
          onClose={() => setIsBulkOutOpen(false)}
          onSuccess={() => {
            setIsBulkOutOpen(false);
            refetch();
          }}
        />
      )}

      {isHistoryOpen && (
        <FinishGoodHistoryModal 
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
      
    </div>
  );
}
