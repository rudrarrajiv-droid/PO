import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, History, FileText, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { queryDocuments } from '../../lib/firebase/services';
import { where, orderBy } from 'firebase/firestore';

export default function ReelHistoryModal({ onClose }: { onClose: () => void }) {
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  // Fetch the actual reel
  const { data: reels = [], isLoading: loadingReel } = useQuery({
    queryKey: ['reels', submittedSearch],
    queryFn: () => queryDocuments('reels', [where('reelNumber', '==', submittedSearch.toUpperCase())]) as Promise<any[]>,
    enabled: !!submittedSearch
  });

  // Fetch transactions for that reel
  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['reelTransactions', submittedSearch],
    queryFn: () => queryDocuments('reelTransactions', [
      where('reelNumber', '==', submittedSearch.toUpperCase()),
      // Note: Firestore requires a composite index if combining equality and range/orderBy.
      // We will sort client side to avoid forcing the user to create a Firestore index right now.
    ]) as Promise<any[]>,
    enabled: !!submittedSearch
  });

  const reel = reels[0];
  const isLoading = loadingReel || loadingTx;
  const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSubmittedSearch(searchInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center">
              <History className="w-5 h-5 mr-2 text-primary" />
              Reel History Audit
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Search for a reel number to view its complete immutable ledger.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 bg-secondary/20 border-b border-border shrink-0">
          <form onSubmit={handleSearch} className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
            <input 
              type="text" 
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Enter exact Reel Number (e.g. R-1001)..." 
              className="pl-10 pr-24 py-2 w-full text-base rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            />
            <button type="submit" className="absolute right-1 top-1 bottom-1 bg-primary text-primary-foreground px-4 rounded text-sm font-medium hover:bg-primary/90 transition-colors">
              Audit
            </button>
          </form>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-secondary/5">
          {!submittedSearch ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <History className="w-12 h-12 mb-4 opacity-20" />
              <p>Enter a reel number above to search.</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Searching immutable records...</div>
          ) : !reel ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-semibold">Reel Not Found</p>
              <p className="text-sm mt-1">No reel matching "{submittedSearch}" exists in the database.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Reel Overview Card */}
              <div className="bg-card border border-border shadow-sm rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-primary tracking-tight">{reel.reelNumber}</h3>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                      {reel.paperType} | {reel.reelSize}" | {reel.bf} BF | {reel.gsm} GSM
                    </p>
                  </div>
                  <div className="text-right bg-secondary/50 px-4 py-2 rounded-lg border border-border/50">
                    <div className="text-xs uppercase text-muted-foreground font-bold tracking-wider">Current Balance</div>
                    <div className="text-2xl font-bold text-green-600">{reel.currentBalance} Kg</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm mt-4 pt-4 border-t border-border">
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Original Inward Weight</span>
                    <span className="font-semibold">{reel.weight} Kg</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Supplier</span>
                    <span className="font-semibold">{reel.supplierName || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Created By</span>
                    <span className="font-semibold">{reel.createdBy}</span>
                  </div>
                </div>
              </div>

              {/* Ledger Timeline */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 pl-1">Transaction Ledger</h4>
                
                <div className="space-y-3">
                  {sortedTransactions.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic pl-1">No transactions found.</div>
                  ) : (
                    sortedTransactions.map((tx, idx) => (
                      <div key={tx.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between shadow-sm">
                        
                        <div className="flex items-center gap-4">
                          {tx.type === 'INWARD' ? (
                            <div className="bg-green-100 text-green-600 p-2 rounded-full"><ArrowDownToLine className="w-5 h-5" /></div>
                          ) : (
                            <div className="bg-red-100 text-red-600 p-2 rounded-full"><ArrowUpFromLine className="w-5 h-5" /></div>
                          )}
                          
                          <div>
                            <div className="font-bold flex items-center gap-2">
                              {tx.type}
                              {tx.jobCardId && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">JC: {tx.jobCardId}</span>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(tx.date).toLocaleString('en-IN')} • By {tx.performedBy}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`font-bold text-lg ${tx.type === 'INWARD' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'INWARD' ? '+' : '-'}{tx.quantity} Kg
                          </div>
                          <div className="text-xs text-muted-foreground font-medium mt-1">
                            Balance: {tx.remainingBalance} Kg
                          </div>
                        </div>

                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
