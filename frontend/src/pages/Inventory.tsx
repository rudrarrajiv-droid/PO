import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, ArrowDownToLine, ArrowUpFromLine, History } from 'lucide-react';
import { cn } from '../lib/utils';
import { queryDocuments } from '../lib/firebase/services';
import BulkInwardModal from './inventory/BulkInwardModal';
import OutwardModal from './inventory/OutwardModal';
import ReelHistoryModal from './inventory/ReelHistoryModal';
import ExportButtons from '../components/ExportButtons';

export default function Inventory() {
  const [isBulkInwardOpen, setIsBulkInwardOpen] = useState(false);
  const [isOutwardOpen, setIsOutwardOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: reels = [], isLoading: loadingReels, refetch } = useQuery({
    queryKey: ['reels'],
    queryFn: () => queryDocuments('reels', []) as Promise<any[]>
  });

  const sortedAndFilteredReels = useMemo(() => {
    let result = reels.filter(r => 
      (r.reelNumber?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (r.paperType?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (r.bf?.toLowerCase() || '').includes(search.toLowerCase())
    );

    // Sort by: Balance > 0 first, then Paper Type → Reel Size → BF → GSM
    result.sort((a, b) => {
      const aBal = Number(a.currentBalance) || 0;
      const bBal = Number(b.currentBalance) || 0;
      const aEmpty = aBal <= 0;
      const bEmpty = bBal <= 0;

      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;

      if (a.paperType !== b.paperType) return (a.paperType || '').localeCompare(b.paperType || '');
      if (a.reelSize !== b.reelSize) return (Number(a.reelSize) || 0) - (Number(b.reelSize) || 0);
      if (a.bf !== b.bf) return (a.bf || '').localeCompare(b.bf || '');
      return (Number(a.gsm) || 0) - (Number(b.gsm) || 0);
    });

    return result;
  }, [reels, search]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reel Inventory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage paper reels and transactions</p>
        </div>
        <div className="flex gap-3">
          <ExportButtons 
            data={sortedAndFilteredReels} 
            filenamePrefix="ReelInventory"
            title="Reel Inventory Status"
            columnMap={{
              'reelNumber': 'Reel No',
              'paperType': 'Type',
              'reelSize': 'Size',
              'bf': 'BF',
              'gsm': 'GSM',
              'weight': 'Initial Wt',
              'currentBalance': 'Balance Wt',
              'supplierName': 'Supplier',
              'manufacturerName': 'Manufacturer'
            }}
          />
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="bg-secondary text-secondary-foreground border border-border px-4 py-2 flex items-center text-sm font-medium rounded-md shadow hover:bg-secondary/80 transition-colors"
          >
            <History className="w-4 h-4 mr-2 text-primary" />
            Reel History
          </button>
          
          <button 
            onClick={() => setIsOutwardOpen(true)}
            className="bg-red-600 text-white px-4 py-2 flex items-center text-sm font-medium rounded-md shadow hover:bg-red-700 transition-colors"
          >
            <ArrowUpFromLine className="w-4 h-4 mr-2" />
            Outward (Issue)
          </button>
          
          <button 
            onClick={() => setIsBulkInwardOpen(true)}
            className="bg-green-600 text-white px-4 py-2 flex items-center text-sm font-medium rounded-md shadow hover:bg-green-700 transition-colors"
          >
            <ArrowDownToLine className="w-4 h-4 mr-2" />
            Bulk Inward (IN)
          </button>
        </div>
      </div>

      <div className="flex-1 bg-card border border-border shadow-sm rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/20">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reels by No, Type, BF..." 
              className="pl-9 pr-4 py-2 w-full text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="text-xs text-muted-foreground">
             <span className="font-semibold text-foreground">{sortedAndFilteredReels.length}</span> records found
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loadingReels ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 font-medium">Reel No</th>
                  <th className="px-6 py-3 font-medium">Specs (Type/Size/BF/GSM)</th>
                  <th className="px-6 py-3 font-medium">Supplier</th>
                  <th className="px-6 py-3 font-medium text-blue-600">Initial Wt</th>
                  <th className="px-6 py-3 font-medium text-red-600">Consumed</th>
                  <th className="px-6 py-3 font-medium text-green-600">Balance</th>
                  <th className="px-6 py-3 font-medium">Inward Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedAndFilteredReels.map((reel: any) => {
                  const consumed = (Number(reel.weight) || 0) - (Number(reel.currentBalance) || 0);
                  
                  return (
                    <tr key={reel.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{reel.reelNumber}</td>
                      <td className="px-6 py-4 font-medium">
                        {reel.paperType} | {reel.reelSize}" | {reel.bf} BF | {reel.gsm} GSM
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="text-foreground">{reel.supplierName}</div>
                        {reel.manufacturerName !== reel.supplierName && (
                          <div className="text-xs">Mfr: {reel.manufacturerName}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-blue-600">{reel.weight} Kg</td>
                      <td className="px-6 py-4 text-red-600">{consumed > 0 ? `${consumed.toFixed(1)} Kg` : '-'}</td>
                      <td className="px-6 py-4 font-bold text-green-600">{reel.currentBalance} Kg</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {reel.inwardDate ? new Date(reel.inwardDate).toLocaleDateString('en-IN') : '-'}
                      </td>
                    </tr>
                  );
                })}
                {sortedAndFilteredReels.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto text-muted mb-3" />
                      <p>No inventory records found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isBulkInwardOpen && (
        <BulkInwardModal 
          reels={reels}
          onClose={() => setIsBulkInwardOpen(false)} 
          onSuccess={() => {
            setIsBulkInwardOpen(false);
            refetch();
          }} 
        />
      )}

      {isOutwardOpen && (
        <OutwardModal
          reels={reels}
          onClose={() => setIsOutwardOpen(false)}
          onSuccess={() => {
            setIsOutwardOpen(false);
            refetch();
          }}
        />
      )}

      {isHistoryOpen && (
        <ReelHistoryModal
          reels={reels}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </div>
  );
}
