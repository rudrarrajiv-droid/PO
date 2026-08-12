import React, { useState } from 'react';
import { X, Search, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryDocuments } from '../../lib/firebase/services';
import { cn } from '../../lib/utils';
import { where } from 'firebase/firestore';

export default function LinkedJobCardsModal({ po, onClose }: { po: any, onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: jobCards = [], isLoading } = useQuery({
    queryKey: ['jobcards', 'po', po.id],
    queryFn: async () => {
      // Query Job Cards linked to this PO
      const data = await queryDocuments('jobCards', [
        where('poId', '==', po.id)
      ]) as any[];
      return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });

  const filteredCards = jobCards.filter(jc => 
    (jc.jobCardNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (jc.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (jc.status || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">Linked Job Cards</h2>
            <p className="text-sm text-muted-foreground mt-1 font-mono">PO NO: {po.poNo}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 bg-secondary/10 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by JC No, Product, Status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring shadow-sm"
            />
          </div>
          <div className="text-sm font-semibold text-muted-foreground">
            Total Linked: {jobCards.length}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">Loading Job Cards...</div>
          ) : filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="w-12 h-12 mb-3 text-muted-foreground/30" />
              <p className="text-base font-semibold">No Job Cards found</p>
              {searchTerm && <p className="text-xs mt-1">Try clearing your search term.</p>}
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground uppercase text-xs font-semibold border-b border-border sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Job Card No</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCards.map((jc) => (
                    <tr key={jc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-foreground">{jc.jobCardNo}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {jc.targetDate ? new Date(jc.targetDate).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="px-4 py-3 truncate max-w-[150px]" title={jc.customerName}>{jc.customerName}</td>
                      <td className="px-4 py-3 font-medium truncate max-w-[200px]" title={jc.productName}>{jc.productName}</td>
                      <td className="px-4 py-3 text-right font-bold">{jc.orderQty}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider", 
                          jc.status === 'COMPLETED' ? "bg-green-100 text-green-800" :
                          jc.status === 'IN_PROCESS' ? "bg-blue-100 text-blue-800" :
                          jc.status === 'DELAYED' ? "bg-red-100 text-red-800" :
                          jc.status === 'DELETED' ? "bg-gray-200 text-gray-600" :
                          jc.status === 'PENDING APPROVAL' ? "bg-orange-100 text-orange-700" :
                          "bg-yellow-100 text-yellow-800"
                        )}>
                          {jc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
