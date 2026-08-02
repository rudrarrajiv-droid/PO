import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, CheckCircle2, CircleDashed, AlertTriangle, Search } from 'lucide-react';
import { queryDocuments } from '../../lib/firebase/services';
import { executeReelAllocation } from '../../lib/firebase/services';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

export default function ReelAllocationModal({ jobCard, onClose, onSuccess }: { jobCard: any, onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allocations, setAllocations] = useState<{ [reelId: string]: number }>({});
  const [searchTerm, setSearchTerm] = useState('');

  const { data: reels = [], isLoading: loadingReels } = useQuery({
    queryKey: ['reels-available'],
    queryFn: async () => {
      const data = await queryDocuments('reels', []) as any[];
      return data.filter(r => r.currentBalance > 0);
    },
  });

  // Calculate required weights per layer based on exact formula
  const layerRequirements = useMemo(() => {
    if (!jobCard?.productSnapshot) return [];
    
    const snapshot = jobCard.productSnapshot;
    const orderQty = jobCard.orderQty || 0;
    const ups = snapshot.ups > 0 ? snapshot.ups : 1;
    const noOfPaper = Math.ceil(orderQty / ups);

    return (snapshot.layers || []).map((layer: any, idx: number) => {
      let gsm = Number(layer.gsm) || 0;
      let reqWeight = 0;
      
      if (gsm > 0 && snapshot.reelSize > 0 && snapshot.cutSize > 0) {
        let eff_gsm = gsm;
        if ((layer.layerName || '').toLowerCase().includes('flute')) {
          eff_gsm = gsm * 1.4;
        }
        reqWeight = (snapshot.reelSize * snapshot.cutSize * eff_gsm) / 3100 / 500 * noOfPaper;
        reqWeight = Math.round(reqWeight * 100) / 100;
      }

      return {
        id: `layer-${idx}`,
        layerName: layer.layerName,
        paperType: layer.paperType,
        bf: layer.bf,
        gsm: String(layer.gsm),
        reelSize: String(snapshot.reelSize),
        requiredWeight: reqWeight
      };
    });
  }, [jobCard]);

  const totalRequiredWeight = layerRequirements.reduce((sum: number, l: any) => sum + l.requiredWeight, 0);
  const totalAllocatedWeight = Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
  
  // Previously allocated from earlier operations (if any)
  const existingAllocationsWeight = (jobCard.allocations || []).reduce((sum: number, a: any) => sum + (a.allocatedWeight || 0), 0);
  const remainingTotalNeeded = Math.max(0, totalRequiredWeight - existingAllocationsWeight);

  const handleAllocate = (reelId: string, weightStr: string, maxAvailable: number) => {
    let w = Number(weightStr);
    if (isNaN(w) || w < 0) w = 0;
    if (w > maxAvailable) w = maxAvailable;

    setAllocations(prev => {
      const updated = { ...prev, [reelId]: w };
      if (w === 0) delete updated[reelId];
      return updated;
    });
  };

  const onSubmit = async () => {
    const payload = Object.keys(allocations).map(reelId => {
      const r = reels.find(x => x.id === reelId);
      return {
        reelId,
        reelNumber: r?.reelNumber || 'Unknown',
        allocatedWeight: allocations[reelId]
      };
    }).filter(x => x.allocatedWeight > 0);

    if (payload.length === 0) {
      alert('No weight allocated.');
      return;
    }

    try {
      setIsSubmitting(true);
      await executeReelAllocation(jobCard.id, payload, user?.name);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to allocate reels');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group Reels: Exact Matches vs Others
  // Exact match logic: For ANY layer in the requirements, if it perfectly matches.
  const exactMatchReels = reels.filter(r => {
    return layerRequirements.some((req: any) => 
      r.reelSize === req.reelSize &&
      r.paperType === req.paperType &&
      r.bf === req.bf &&
      r.gsm === req.gsm
    );
  });

  const exactMatchIds = new Set(exactMatchReels.map(r => r.id));
  
  const otherReels = reels.filter(r => 
    !exactMatchIds.has(r.id) && 
    (r.reelNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
     r.paperType.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-card w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-full border border-border">
        
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0 bg-secondary/30">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center">
              Reel Allocation
            </h2>
            <p className="text-sm text-muted-foreground">Job Card: <span className="font-bold text-primary">{jobCard?.jobCardNo}</span> | Product: {jobCard?.productName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
          
          {/* Left Panel: Requirements */}
          <div className="w-full md:w-1/3 flex flex-col gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-bold text-blue-900 mb-1">Total Requirements</h3>
              <div className="flex justify-between items-end">
                <span className="text-sm text-blue-700">Weight Needed:</span>
                <span className="text-2xl font-bold text-blue-700">{totalRequiredWeight} <span className="text-sm font-medium">Kg</span></span>
              </div>
              <div className="flex justify-between items-end mt-2">
                <span className="text-sm text-blue-700">Already Allocated:</span>
                <span className="text-lg font-bold text-blue-700">{existingAllocationsWeight} <span className="text-sm font-medium">Kg</span></span>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden flex-1">
              <div className="bg-secondary/50 p-3 border-b border-border font-semibold text-sm">
                Layer Breakdown (Snapshot)
              </div>
              <div className="p-0 overflow-y-auto max-h-[400px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="p-2 font-medium">Layer</th>
                      <th className="p-2 font-medium">Specs</th>
                      <th className="p-2 font-medium text-right">Req. Wt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {layerRequirements.map((req: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2 font-bold">{req.layerName}</td>
                        <td className="p-2 text-muted-foreground">
                          {req.reelSize}" | {req.paperType} | {req.bf} BF | {req.gsm} GSM
                        </td>
                        <td className="p-2 text-right font-bold text-foreground">{req.requiredWeight} Kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Panel: Inventory Selection */}
          <div className="w-full md:w-2/3 flex flex-col h-full border border-border rounded-lg overflow-hidden">
            
            {/* Header & Total Allocation */}
            <div className="p-4 bg-secondary/20 border-b border-border flex justify-between items-center">
              <h3 className="font-bold">Select Reels</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Current Selection:</span>
                <span className={cn("text-xl font-bold px-3 py-1 rounded", 
                  totalAllocatedWeight >= remainingTotalNeeded && remainingTotalNeeded > 0 ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
                )}>
                  {totalAllocatedWeight} Kg
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-muted/10 space-y-6">
              
              {loadingReels ? (
                <div className="text-center p-8 text-muted-foreground">Loading inventory...</div>
              ) : (
                <>
                  {/* Exact Matches */}
                  <div>
                    <h4 className="flex items-center text-sm font-bold text-green-700 mb-3 uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Perfect Matches
                    </h4>
                    {exactMatchReels.length === 0 ? (
                      <div className="p-4 border border-dashed border-border rounded-lg text-sm text-muted-foreground text-center bg-background">
                        No reels in inventory exactly match the required specifications.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {exactMatchReels.map(r => (
                          <ReelAllocationRow 
                            key={r.id} 
                            reel={r} 
                            allocated={allocations[r.id] || ''} 
                            onChange={(val) => handleAllocate(r.id, val, r.currentBalance)} 
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Other Reels Escape Hatch */}
                  <div className="pt-4 border-t border-border">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="flex items-center text-sm font-bold text-amber-700 uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Other Available Reels
                      </h4>
                      <div className="relative w-48">
                        <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground" />
                        <input 
                          type="text" 
                          placeholder="Search..." 
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="w-full pl-7 pr-2 py-1 text-xs border border-input rounded bg-background"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                      {otherReels.map(r => (
                        <ReelAllocationRow 
                          key={r.id} 
                          reel={r} 
                          allocated={allocations[r.id] || ''} 
                          onChange={(val) => handleAllocate(r.id, val, r.currentBalance)} 
                          isOther
                        />
                      ))}
                      {otherReels.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2">No other reels found.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
              
            </div>
          </div>
          
        </div>

        <div className="p-5 border-t border-border bg-card shrink-0 flex justify-between items-center rounded-b-xl">
          {totalAllocatedWeight > 0 && totalAllocatedWeight < remainingTotalNeeded ? (
             <span className="text-sm font-semibold text-amber-600 flex items-center">
               <AlertTriangle className="w-4 h-4 mr-2" />
               Shortage of {(remainingTotalNeeded - totalAllocatedWeight).toFixed(2)} Kg
             </span>
          ) : <div></div>}

          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={onSubmit}
              disabled={isSubmitting || totalAllocatedWeight === 0}
              className="px-6 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow flex items-center disabled:opacity-50"
            >
              {isSubmitting && <CircleDashed className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Allocation
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function ReelAllocationRow({ reel, allocated, onChange, isOther = false }: { reel: any, allocated: number | string, onChange: (v: string) => void, isOther?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between p-3 rounded-lg border", 
      allocated ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/30"
    )}>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-sm">{reel.reelNumber}</span>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-secondary rounded">Bal: {reel.currentBalance} Kg</span>
        </div>
        <div className="text-xs text-muted-foreground flex gap-2">
          <span>{reel.reelSize}"</span> | 
          <span>{reel.paperType}</span> | 
          <span>{reel.bf} BF</span> | 
          <span>{reel.gsm} GSM</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">Allocate:</span>
        <input 
          type="number" 
          value={allocated}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          max={reel.currentBalance}
          min={0}
          className="w-24 text-right px-2 py-1.5 text-sm border border-input rounded focus:outline-none focus:border-primary bg-background font-bold"
        />
        <span className="text-xs text-muted-foreground">Kg</span>
      </div>
    </div>
  );
}
