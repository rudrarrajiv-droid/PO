import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, History, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { queryDocuments } from '../../lib/firebase/services';
import type { FinishGoodTransaction } from '../../lib/types/models';
import { format } from 'date-fns';
import ExportButtons from '../../components/ExportButtons';

export default function FinishGoodHistoryModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['finishGoodTransactions'],
    queryFn: () => queryDocuments('finishGoodTransactions', []) as Promise<FinishGoodTransaction[]>
  });

  // Sort descending by created/date
  const sortedHistory = [...history].sort((a, b) => {
    // If they have date, fallback to createdAt
    const dateA = new Date(a.date || a.createdAt).getTime();
    const dateB = new Date(b.date || b.createdAt).getTime();
    return dateB - dateA;
  });

  const filteredHistory = sortedHistory.filter(h => {
    const searchString = `${h.referenceNo || ''} ${h.finishGoodId || ''} ${h.performedBy || ''} ${h.transporterName || ''} ${h.place || ''}`.toLowerCase();
    return searchString.includes(search.toLowerCase());
  });

  // We need to fetch finish goods to map finishGoodId to Name, or we can just hope it's not needed if we save product Name in transaction?
  // Wait, in our transaction saving, we only saved finishGoodId. Let's fetch finishGoods to map.
  const { data: fgList = [] } = useQuery({
    queryKey: ['finishGoods'],
    queryFn: () => queryDocuments('finishGoods', []) as Promise<any[]>
  });

  const getProductName = (id: string) => {
    const fg = fgList.find(item => item.productId === id);
    if (fg) return `${fg.productName} (${fg.customerName})`;
    return id; // fallback
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-6xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/30 shrink-0">
          <h2 className="text-xl font-bold text-foreground flex items-center">
            <History className="w-6 h-6 mr-3 text-primary" />
            Finish Goods Transaction History
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Export */}
        <div className="p-4 border-b border-border bg-card shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by Invoice, Customer, or Transporter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="text-sm text-muted-foreground hidden sm:block">
              Showing {filteredHistory.length} transactions
            </div>
          </div>
          
          <div className="flex-shrink-0">
            <ExportButtons 
              data={filteredHistory.map(h => ({
                ...h,
                date: h.date || (h.createdAt ? format(new Date(h.createdAt), 'yyyy-MM-dd') : ''),
                productName: getProductName(h.finishGoodId),
                freight: h.freight || 0,
                point: h.point || 0,
                holding: h.holding || 0,
                others: h.others || 0,
              }))} 
              filenamePrefix="FinishGoodTransactions"
              title="Finish Goods Transaction History"
              columnMap={{
                'date': 'Date',
                'type': 'Type',
                'category': 'Category',
                'productName': 'Product Name',
                'quantity': 'Quantity',
                'remainingBalance': 'Balance',
                'invoiceNo': 'Invoice No',
                'place': 'Place',
                'transporterName': 'Transporter Name',
                'vehicleNo': 'Vehicle No',
                'vehicleSize': 'Vehicle Size',
                'freight': 'Freight',
                'point': 'Point',
                'holding': 'Holding Charges',
                'others': 'Others',
                'performedBy': 'Performed By'
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-muted/20">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading history...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-card border-b border-border sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Product & Customer</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Remaining Bal</th>
                  <th className="px-4 py-3 font-medium">Invoice/Ref No.</th>
                  <th className="px-4 py-3 font-medium">Transporter</th>
                  <th className="px-4 py-3 font-medium">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/50 transition-colors bg-card">
                    <td className="px-4 py-3 font-medium">
                      {item.date ? format(new Date(item.date), 'dd MMM yyyy') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {item.type === 'IN' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">
                          <ArrowDownToLine className="w-3 h-3 mr-1" /> IN
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700">
                          <ArrowUpFromLine className="w-3 h-3 mr-1" /> OUT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
                        item.category === 'REGULAR' || item.category === 'DISPATCH' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {getProductName(item.finishGoodId)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${item.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                      {item.type === 'IN' ? '+' : '-'}{item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-blue-700">
                      {item.remainingBalance}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {item.referenceNo || item.invoiceNo || '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {item.transporterName ? `${item.transporterName} (${item.vehicleNo})` : '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {item.performedBy}
                    </td>
                  </tr>
                ))}
                
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                      No transaction history found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
