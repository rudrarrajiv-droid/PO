import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryDocuments } from '../../lib/firebase/services';
import { Zap, CircleDashed, CheckCircle2, AlertTriangle, Search, X, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { isJobCardAllocationComplete } from '../JobCards';

interface ReelAllocationWizardProps {
  jobCard: any;
  onBack: () => void;
  onConfirm: (layers: any[]) => void;
  isAdmin: boolean;
  onSkip?: () => void;
}

const parseReelDate = (reelNo: string | number) => {
  const str = String(reelNo);
  if (str.length < 5) return Infinity; 
  const yy = parseInt(str.slice(-4, -2), 10);
  const mm = parseInt(str.slice(0, -4), 10);
  return yy * 12 + mm;
};

export default function ReelAllocationWizard({ jobCard, onBack, onConfirm, isAdmin, onSkip }: ReelAllocationWizardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allocations, setAllocations] = useState<any[]>([]);
  
  // State for Manual Match modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualLayerIndex, setManualLayerIndex] = useState<number | null>(null);
  const [manualSearch, setManualSearch] = useState({
    paperType: '',
    reelSize: '',
    bf: '',
    gsm: '',
    reelNumber: ''
  });

  const { data: rawReels = [], isLoading: loadingReels } = useQuery({
    queryKey: ['reels-available'],
    queryFn: async () => {
      const data = await queryDocuments('reels', []) as any[];
      return data.filter(r => r.currentBalance > 0 && r.status !== 'INACTIVE');
    },
  });

  // Refund this specific Job Card's old reservations so the UI doesn't double-penalize it
  const selfReservedWeights = useMemo(() => {
    const reserved: Record<string, number> = {};
    if (jobCard && !['COMPLETED', 'CANCELLED'].includes(jobCard.status) && jobCard.productSnapshot?.layers) {
      jobCard.productSnapshot.layers.forEach((layer: any) => {
        if (layer.allocatedReels && Array.isArray(layer.allocatedReels)) {
          layer.allocatedReels.forEach((allocReel: any) => {
            if (allocReel.reelId) {
              reserved[allocReel.reelId] = (reserved[allocReel.reelId] || 0) + (Number(allocReel.allocatedWeight) || 0);
            }
          });
        }
      });
    }
    return reserved;
  }, [jobCard]);

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
        ...layer,
        originalIndex: idx,
        requiredWeight: reqWeight,
        reqSize: snapshot.reelSize
      };
    }).filter((l: any) => l.requiredWeight > 0);
  }, [jobCard]);

  useEffect(() => {
    if (loadingReels || rawReels.length === 0 || allocations.length > 0) return;

    let virtualReels = rawReels.map(r => {
      const globalReserved = r.activeReservedWeight || 0;
      const selfReserved = selfReservedWeights[r.id] || 0;
      // Actual Available = Current Balance - Global Reserved + What we already own
      const availableAllocationWeight = Math.max(0, r.currentBalance - globalReserved + selfReserved);
      return { ...r, availableAllocationWeight, virtualBalance: availableAllocationWeight };
    }).filter(r => r.currentBalance > 0 || selfReservedWeights[r.id] > 0);

    let initialAllocations: any[] = [];
    const offsets = [0, 0.5, 1.0, 1.5, 2.0];

    layerRequirements.forEach((layer: any) => {
      let remainingWeight = layer.requiredWeight;
      let layerReels: any[] = [];
      
      const reqSize = Number(layer.reqSize);
      const reqBF = Number(layer.bf);
      const reqGSM = Number(layer.gsm);
      const reqType = (layer.paperType || '').toLowerCase();

      for (const offset of offsets) {
        if (remainingWeight <= 0.1) break; 
        const targetSize = reqSize + offset;

        let candidates = virtualReels.filter(r => {
          if (r.virtualBalance <= 0) return false;
          if ((r.paperType || '').toLowerCase() !== reqType) return false;
          if (Number(r.bf) !== reqBF) return false;
          if (Number(r.gsm) !== reqGSM) return false;
          if (Number(r.reelSize) !== targetSize) return false;
          return true;
        });

        candidates.sort((a, b) => {
          const ageA = parseReelDate(a.reelNumber);
          const ageB = parseReelDate(b.reelNumber);
          if (ageA !== ageB) return ageA - ageB;
          return a.virtualBalance - b.virtualBalance; 
        });

        for (const candidate of candidates) {
          if (remainingWeight <= 0.1) break;
          const allocWeight = Math.min(remainingWeight, candidate.virtualBalance);
          
          layerReels.push({
            reelId: candidate.id,
            reelNumber: candidate.reelNumber,
            allocatedWeight: allocWeight,
            matchScore: 100, 
            isAuto: true,
            reelSize: candidate.reelSize,
            sizeExcess: offset,
            bf: candidate.bf,
            gsm: candidate.gsm,
            actualReelWeight: candidate.currentBalance
          });
          
          remainingWeight -= allocWeight;
          candidate.virtualBalance -= allocWeight; 
        }
      }

      initialAllocations.push({
        layerIndex: layer.originalIndex,
        reels: layerReels,
        isComplete: remainingWeight <= 0.1
      });
    });

    setAllocations(initialAllocations);
  }, [loadingReels, rawReels, layerRequirements, selfReservedWeights]);

  const isFullyAllocated = allocations.length > 0 && layerRequirements.every((req: any) => {
    const alloc = allocations.find(a => a.layerIndex === req.originalIndex);
    if (!alloc) return false;
    const totalAlloc = alloc.reels.reduce((sum: number, r: any) => sum + r.allocatedWeight, 0);
    return totalAlloc >= (req.requiredWeight - 0.1);
  });

  const handleConfirm = () => {
    setIsSubmitting(true);
    const updatedLayers = [...(jobCard.productSnapshot.layers || [])];
    
    allocations.forEach(alloc => {
      updatedLayers[alloc.layerIndex] = {
        ...updatedLayers[alloc.layerIndex],
        allocatedReels: alloc.reels
      };
    });
    onConfirm(updatedLayers);
  };

  const openManualMatch = (layerIndex: number) => {
    setManualLayerIndex(layerIndex);
    setShowManualModal(true);
  };

  const removeAllocation = (layerIndex: number, reelId: string) => {
    setAllocations(prev => prev.map(alloc => {
      if (alloc.layerIndex !== layerIndex) return alloc;
      return {
        ...alloc,
        reels: alloc.reels.filter((r: any) => r.reelId !== reelId)
      };
    }));
  };

  const updateAllocationWeight = (layerIndex: number, reelId: string, newWeight: number) => {
    // 1. Get the raw reel to check max capacity
    const rawReel = rawReels.find(r => r.id === reelId);
    if (!rawReel) return;

    // 2. Check reserved weight globally minus what this job card already owns
    const globalRes = rawReel.activeReservedWeight || 0;
    const selfRes = selfReservedWeights[reelId] || 0;
    const effectiveGlobalRes = globalRes - selfRes;
    
    // 3. Check reserved weight by other allocations in the UI
    let usedInUIByOthers = 0;
    allocations.forEach(a => {
      a.reels.forEach((r: any) => {
        if (r.reelId === reelId) {
          usedInUIByOthers += r.allocatedWeight;
        }
      });
    });

    const allocList = allocations.find(a => a.layerIndex === layerIndex);
    const oldReelAlloc = allocList?.reels.find((r: any) => r.reelId === reelId);
    const oldWeight = oldReelAlloc ? oldReelAlloc.allocatedWeight : 0;
    
    usedInUIByOthers -= oldWeight; // Exclude its own old weight

    const maxAvailable = Math.max(0, rawReel.currentBalance - effectiveGlobalRes - usedInUIByOthers);

    if (newWeight > maxAvailable) {
      alert("Invalid Allocation\n\nAllocated weight exceeds available reel weight.\nPlease reduce allocation or select another reel.");
      newWeight = maxAvailable;
    }

    setAllocations(prev => prev.map(alloc => {
      if (alloc.layerIndex !== layerIndex) return alloc;
      return {
        ...alloc,
        reels: alloc.reels.map((r: any) => {
          if (r.reelId === reelId) {
            return { ...r, allocatedWeight: Math.max(0, newWeight) };
          }
          return r;
        })
      };
    }));
  };

  const addManualAllocation = (reel: any) => {
    if (manualLayerIndex === null) return;
    
    const reqLayer = layerRequirements.find((l: any) => l.originalIndex === manualLayerIndex);
    if (!reqLayer) return;

    const currentAlloc = allocations.find(a => a.layerIndex === manualLayerIndex);
    const totalAllocated = currentAlloc ? currentAlloc.reels.reduce((sum: number, r: any) => sum + r.allocatedWeight, 0) : 0;
    const remainingWeight = Math.max(0, reqLayer.requiredWeight - totalAllocated);
    
    if (remainingWeight <= 0) {
      alert("Layer is already fully allocated.");
      return;
    }

    let usedInUI = 0;
    allocations.forEach(a => {
      a.reels.forEach((r: any) => {
        if (r.reelId === reel.id) usedInUI += r.allocatedWeight;
      });
    });

    const globalRes = reel.activeReservedWeight || 0;
    const selfRes = selfReservedWeights[reel.id] || 0;
    const effectiveGlobalRes = globalRes - selfRes;
    const actualAvailable = Math.max(0, reel.currentBalance - effectiveGlobalRes - usedInUI);

    if (actualAvailable <= 0) {
      alert("This reel has no available weight left.");
      return;
    }

    const allocWeight = Math.min(remainingWeight, actualAvailable);
    const sizeExcess = Math.max(0, Number(reel.reelSize) - Number(reqLayer.reqSize));

    setAllocations(prev => prev.map(alloc => {
      if (alloc.layerIndex !== manualLayerIndex) return alloc;
      return {
        ...alloc,
        reels: [...alloc.reels, {
          reelId: reel.id,
          reelNumber: reel.reelNumber,
          allocatedWeight: allocWeight,
          matchScore: reel.matchScore,
          isAuto: false,
          reelSize: reel.reelSize,
          sizeExcess: sizeExcess,
          bf: reel.bf,
          gsm: reel.gsm,
          actualReelWeight: reel.currentBalance
        }]
      };
    }));

    // Clear search for next time
    setManualSearch({ paperType: '', reelSize: '', bf: '', gsm: '', reelNumber: '' });
  };

  const manualReelsList = useMemo(() => {
    if (manualLayerIndex === null) return [];
    
    const reqLayer = layerRequirements.find((l: any) => l.originalIndex === manualLayerIndex);
    if (!reqLayer) return [];

    const reqType = (reqLayer.paperType || '').toLowerCase();
    const reqSize = Number(reqLayer.reqSize);
    const reqBF = Number(reqLayer.bf);
    const reqGSM = Number(reqLayer.gsm);

    const uiReserved: Record<string, number> = {};
    allocations.forEach(a => {
      a.reels.forEach((r: any) => {
        uiReserved[r.reelId] = (uiReserved[r.reelId] || 0) + r.allocatedWeight;
      });
    });

    let results = rawReels
      .filter(r => {
         // Hide zero balance reels from manual search unless explicitly searching by reel number
         if (manualSearch.reelNumber && String(r.reelNumber).toLowerCase().includes(manualSearch.reelNumber.toLowerCase())) return true;
         return r.currentBalance > 0;
      })
      .map(r => {
      const globalRes = r.activeReservedWeight || 0;
      const selfRes = selfReservedWeights[r.id] || 0;
      const effectiveGlobalRes = globalRes - selfRes;
      
      const uiRes = uiReserved[r.id] || 0;
      const avail = Math.max(0, r.currentBalance - effectiveGlobalRes - uiRes);
      
      const reelSize = Number(r.reelSize);
      const reelBF = Number(r.bf);
      const reelGSM = Number(r.gsm);
      
      const sizeDiff = Math.abs(reelSize - reqSize);
      const bfDiff = Math.abs(reelBF - reqBF);
      const gsmDiff = Math.abs(reelGSM - reqGSM);
      const isTypeMatch = (r.paperType || '').toLowerCase() === reqType;
      
      let matchScore = 100;
      if (!isTypeMatch) matchScore -= 80;
      matchScore -= (sizeDiff * 10);
      matchScore -= (bfDiff * 2);
      matchScore -= (gsmDiff * 0.5);
      matchScore = Math.max(0, Math.round(matchScore));

      let matchType = 'Poor Match';
      let matchColor = 'bg-red-100 text-red-800';
      if (isTypeMatch && sizeDiff === 0 && bfDiff === 0 && gsmDiff === 0) {
        matchType = 'Exact Match';
        matchColor = 'bg-green-100 text-green-800';
      } else if (isTypeMatch && sizeDiff <= 0.5 && bfDiff <= 2 && gsmDiff <= 20) {
        matchType = 'Very Good Match';
        matchColor = 'bg-blue-100 text-blue-800';
      } else if (isTypeMatch && sizeDiff <= 1.0 && bfDiff <= 4 && gsmDiff <= 40) {
        matchType = 'Acceptable Match';
        matchColor = 'bg-orange-100 text-orange-800';
      }

      return { 
        ...r, 
        availableAllocationWeight: avail,
        sizeDiff,
        bfDiff,
        gsmDiff,
        matchScore,
        matchType,
        matchColor
      };
    }).filter(r => r.availableAllocationWeight > 0);

    // Apply Live Filters (partial matching)
    if (manualSearch.reelNumber) {
      results = results.filter(r => String(r.reelNumber).toLowerCase().includes(manualSearch.reelNumber.toLowerCase()));
    }
    if (manualSearch.paperType) {
      results = results.filter(r => String(r.paperType).toLowerCase().includes(manualSearch.paperType.toLowerCase()));
    }
    if (manualSearch.reelSize) {
      results = results.filter(r => String(r.reelSize).includes(manualSearch.reelSize));
    }
    if (manualSearch.bf) {
      results = results.filter(r => String(r.bf).includes(manualSearch.bf));
    }
    if (manualSearch.gsm) {
      results = results.filter(r => String(r.gsm).includes(manualSearch.gsm));
    }

    // Sort by: Nearest Size -> Nearest BF -> Nearest GSM -> Highest Match %
    results.sort((a, b) => {
      if (a.sizeDiff !== b.sizeDiff) return a.sizeDiff - b.sizeDiff;
      if (a.bfDiff !== b.bfDiff) return a.bfDiff - b.bfDiff;
      if (a.gsmDiff !== b.gsmDiff) return a.gsmDiff - b.gsmDiff;
      return b.matchScore - a.matchScore;
    });

    return results;
  }, [rawReels, selfReservedWeights, allocations, manualLayerIndex, manualSearch, layerRequirements]);

  const isLoading = loadingReels;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-auto overflow-hidden relative">
      <div className="flex items-center justify-between p-5 border-b border-border shrink-0 bg-blue-900 text-white">
        <div>
          <h2 className="text-xl font-bold flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-400 fill-current" />
            Reel Allocation Engine
          </h2>
          <p className="text-sm text-blue-200 mt-1">Review allocations and manually fulfill any short weights</p>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1 bg-muted/10 relative">
        {isLoading || allocations.length === 0 ? (
          <div className="text-center p-8 flex flex-col items-center justify-center text-muted-foreground">
            <CircleDashed className="w-8 h-8 animate-spin mb-4" />
            <p>Fetching active Job Cards & calculating progressive matches...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {layerRequirements.map((layer: any) => {
              const alloc = allocations.find(a => a.layerIndex === layer.originalIndex);
              const totalAllocated = alloc ? alloc.reels.reduce((sum: number, r: any) => sum + r.allocatedWeight, 0) : 0;
              const remaining = Math.max(0, layer.requiredWeight - totalAllocated);
              const isComplete = remaining <= 0.1;

              return (
                <div key={layer.originalIndex} className={cn("p-4 rounded-lg border shadow-sm bg-white", isComplete ? "border-green-300" : "border-red-300")}>
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                    <div>
                      <h3 className="font-bold text-lg">{layer.layerName} Requirements</h3>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                        {layer.paperType} | Size: {layer.reqSize}" | BF: {layer.bf} | GSM: {layer.gsm}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Required Weight</p>
                      <p className="text-2xl font-black text-primary">{layer.requiredWeight} Kg</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between bg-gray-50 border rounded-md px-3 py-2 text-sm font-semibold mb-2">
                      <div className="w-1/4">Reel Number</div>
                      <div className="w-1/4">Size / BF / GSM</div>
                      <div className="w-1/4">Status</div>
                      <div className="w-1/4 text-right">Weight</div>
                    </div>
                    
                    {alloc && alloc.reels.length > 0 ? (
                      <div className="space-y-2">
                        {alloc.reels.map((r: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded border border-gray-100 hover:bg-gray-50 transition-colors">
                            <div className="w-1/4 font-bold text-gray-900">{r.reelNumber}</div>
                            <div className="w-1/4 text-sm text-gray-600">
                              {r.reelSize}" / {r.bf} / {r.gsm}
                              {r.sizeExcess > 0 && (
                                <span className="ml-2 text-red-600 font-bold bg-red-100 px-1 py-0.5 rounded text-[10px]">
                                  +{r.sizeExcess}" EXCESS
                                </span>
                              )}
                            </div>
                            <div className="w-1/4 flex gap-2 items-center">
                              {r.isAuto ? (
                                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold uppercase">Auto</span>
                              ) : (
                                <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-1 rounded font-bold uppercase">Manual</span>
                              )}
                              <button 
                                onClick={() => removeAllocation(layer.originalIndex, r.reelId)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 ml-2"
                                title="Remove Allocation"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="w-1/4 flex justify-end items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={Math.round(r.allocatedWeight * 100) / 100}
                                onChange={(e) => updateAllocationWeight(layer.originalIndex, r.reelId, parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border rounded text-right font-bold text-green-700 bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                              <span className="text-xs font-bold text-gray-500">Kg</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground p-2 italic text-center">No reels allocated yet.</p>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    {!isComplete ? (
                      <div className="bg-red-50 px-4 py-2 rounded-md border border-red-200 flex-1 mr-4 flex items-center justify-between">
                        <div className="flex items-center text-red-800 font-bold">
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          SHORT WEIGHT: {Math.round(remaining * 100) / 100} Kg
                        </div>
                        <button 
                          onClick={() => openManualMatch(layer.originalIndex)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center"
                        >
                          <Search className="w-4 h-4 mr-1.5" /> Manual Search
                        </button>
                      </div>
                    ) : (
                      <div className="bg-green-50 px-4 py-2 rounded-md border border-green-200 flex-1 mr-4 flex items-center text-green-800 font-bold">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        ALLOCATION COMPLETE
                      </div>
                    )}
                    
                    {isComplete && (
                       <button 
                         onClick={() => openManualMatch(layer.originalIndex)}
                         className="text-blue-600 hover:text-blue-800 text-sm font-semibold underline decoration-blue-300 underline-offset-4"
                       >
                         Change/Manual Search
                       </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Smart Manual Search Modal */}
        {showManualModal && manualLayerIndex !== null && (
          <div className="absolute inset-0 bg-white z-10 flex flex-col p-6 animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Smart Manual Search</h3>
                <p className="text-gray-500 mt-1">
                  Layer: <span className="font-bold text-gray-700">{layerRequirements.find((l:any) => l.originalIndex === manualLayerIndex)?.layerName}</span> | 
                  Required: <span className="font-bold text-gray-700">{layerRequirements.find((l:any) => l.originalIndex === manualLayerIndex)?.paperType} {layerRequirements.find((l:any) => l.originalIndex === manualLayerIndex)?.reqSize}" BF{layerRequirements.find((l:any) => l.originalIndex === manualLayerIndex)?.bf} GSM{layerRequirements.find((l:any) => l.originalIndex === manualLayerIndex)?.gsm}</span>
                </p>
              </div>
              <button onClick={() => setShowManualModal(false)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Paper Type</label>
                <input
                  type="text"
                  placeholder="e.g. VK"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                  value={manualSearch.paperType}
                  onChange={(e) => setManualSearch(p => ({ ...p, paperType: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reel Size</label>
                <input
                  type="text"
                  placeholder="e.g. 31"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                  value={manualSearch.reelSize}
                  onChange={(e) => setManualSearch(p => ({ ...p, reelSize: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">BF</label>
                <input
                  type="text"
                  placeholder="e.g. 20"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                  value={manualSearch.bf}
                  onChange={(e) => setManualSearch(p => ({ ...p, bf: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">GSM</label>
                <input
                  type="text"
                  placeholder="e.g. 200"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                  value={manualSearch.gsm}
                  onChange={(e) => setManualSearch(p => ({ ...p, gsm: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reel Number</label>
                <input
                  type="text"
                  placeholder="e.g. 1125"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                  value={manualSearch.reelNumber}
                  onChange={(e) => setManualSearch(p => ({ ...p, reelNumber: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg border-gray-200 shadow-sm">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-100 sticky top-0 uppercase font-bold text-gray-600 text-xs shadow-sm">
                  <tr>
                    <th className="px-4 py-3">Reel Number</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Size / BF / GSM</th>
                    <th className="px-4 py-3">Available Wt</th>
                    <th className="px-4 py-3">Inward Rate</th>
                    <th className="px-4 py-3">Match %</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {manualReelsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground font-medium">No available reels match your search.</td>
                    </tr>
                  ) : (
                    manualReelsList.map(r => (
                      <tr key={r.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-900">{r.reelNumber}</td>
                        <td className="px-4 py-3 font-medium text-gray-700">{r.paperType}</td>
                        <td className="px-4 py-3 font-medium text-gray-700">{r.reelSize}" / {r.bf} / {r.gsm}</td>
                        <td className="px-4 py-3 font-bold text-green-700">{Math.round(r.availableAllocationWeight * 100) / 100} Kg</td>
                        <td className="px-4 py-3 font-medium text-gray-600">₹{r.rate || 0}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-1 rounded text-xs font-bold", r.matchColor)}>
                            {r.matchType} ({r.matchScore}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => addManualAllocation(r)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-xs font-bold inline-flex items-center transition-colors shadow-sm"
                          >
                            <Plus className="w-3 h-3 mr-1" /> Allocate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border flex justify-between bg-card shrink-0">
        <button type="button" onClick={onBack} className="px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-secondary">
          Cancel & Back
        </button>
        <div className="flex gap-3">
          {isAdmin && onSkip && (
            <button type="button" onClick={onSkip} className="px-4 py-2 text-sm font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50">
              Admin: Skip Allocation
            </button>
          )}
          <button 
            type="button" 
            onClick={handleConfirm}
            disabled={isSubmitting || (!isFullyAllocated && !isAdmin)}
            className="px-6 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 flex items-center shadow-lg shadow-green-600/20 transition-all"
          >
            {isSubmitting ? <CircleDashed className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirm & Save Job Card
          </button>
        </div>
      </div>
    </div>
  );
}
