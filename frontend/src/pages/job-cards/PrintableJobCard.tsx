import React from 'react';

export default function PrintableJobCard({ jobCard }: { jobCard: any }) {
  if (!jobCard) return null;
  const product = jobCard.productSnapshot;

  return (
    <div className="max-w-[210mm] mx-auto bg-white text-black p-8 text-[12px] font-sans leading-tight">
      
      {/* HEADER */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">Production Job Card</h1>
          <p className="font-semibold text-gray-700">Company Name / Logo Here</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold mb-1">{jobCard.jobCardNo}</div>
          <div className="text-sm">Target Date: <span className="font-semibold">{new Date(jobCard.targetDate).toLocaleDateString()}</span></div>
          <div className="text-sm mt-1">Status: <span className="font-semibold">{jobCard.status}</span></div>
          <div className="text-sm mt-1">Priority: <span className="font-semibold uppercase">{jobCard.priority}</span></div>
        </div>
      </div>

      {/* MASTER DATA DETAILS */}
      <div className="grid grid-cols-2 gap-8 mb-6 border border-black p-4">
        
        {/* Customer & Product */}
        <div className="space-y-2">
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">Customer:</span>
            <span className="font-bold">{jobCard.customerName}</span>
          </div>
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">Product:</span>
            <span className="font-bold">{jobCard.productName}</span>
          </div>
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">Artwork No:</span>
            <span>{product?.artworkNo || '-'}</span>
          </div>
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">Order Qty:</span>
            <span className="font-bold text-lg">{jobCard.orderQty} Boxes</span>
          </div>
        </div>

        {/* Specs */}
        <div className="space-y-2">
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">Dimensions:</span>
            <span>{product?.length}"(L) x {product?.width}"(W) x {product?.height}"(H)</span>
          </div>
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">Ply & Flute:</span>
            <span>{product?.ply} Ply, '{product?.flute}' Flute</span>
          </div>
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">Reel x Cut:</span>
            <span className="font-bold">{product?.reelSize}" x {product?.cutSize}"</span>
          </div>
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">UPS:</span>
            <span>{product?.ups || 1}</span>
          </div>
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">Color:</span>
            <span>{product?.color || 'Plain'}</span>
          </div>
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">Joint:</span>
            <span>{product?.jointType === 'PIN' ? `PIN (${product?.pinType || 'N/A'}, Qty: ${product?.pinQty || '-'})` : (product?.jointType === 'PASTING' ? 'PASTING' : 'N/A')}</span>
          </div>
          <div className="flex">
            <span className="w-24 font-bold text-gray-600">Creasing:</span>
            <span>{product?.creasing === 'DIE' ? `DIE (No: ${product?.dieNo || 'N/A'})` : (product?.creasing || 'N/A')}</span>
          </div>
        </div>

      </div>

      {/* PAPER SPECIFICATIONS */}
      <div className="mb-6">
        <h3 className="font-bold text-sm uppercase mb-2 bg-gray-100 p-1 border-y border-black">Paper Layers Configuration</h3>
        <table className="w-full text-left border-collapse border border-black">
          <thead>
            <tr className="bg-gray-50 text-xs">
              <th className="border border-black p-1.5">Layer</th>
              <th className="border border-black p-1.5">Paper Type</th>
              <th className="border border-black p-1.5">BF</th>
              <th className="border border-black p-1.5">GSM</th>
              <th className="border border-black p-1.5 text-right">Required Weight</th>
            </tr>
          </thead>
          <tbody>
            {(product?.layers || []).map((layer: any, idx: number) => (
              <tr key={idx}>
                <td className="border border-black p-1.5 font-bold">{layer.layerName}</td>
                <td className="border border-black p-1.5">{layer.paperType}</td>
                <td className="border border-black p-1.5">{layer.bf}</td>
                <td className="border border-black p-1.5 font-semibold">{layer.gsm}</td>
                <td className="border border-black p-1.5 text-right font-bold">{layer.calculatedWeight || layer.weight || 0} Kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CALCULATIONS */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-black p-3 bg-gray-50 text-center">
          <div className="font-bold text-gray-500 uppercase text-[10px]">Required Cut Sheets</div>
          <div className="text-xl font-bold">{jobCard.paperQuantity || '-'}</div>
        </div>
        <div className="border border-black p-3 bg-gray-50 text-center">
          <div className="font-bold text-gray-500 uppercase text-[10px]">Required Ply Qty</div>
          <div className="text-xl font-bold">{jobCard.plyQuantity || '-'}</div>
        </div>
        <div className="border border-black p-3 bg-gray-50 text-center">
          <div className="font-bold text-gray-500 uppercase text-[10px]">One Box Weight</div>
          <div className="text-xl font-bold">{jobCard.oneBoxWeight} Kg</div>
        </div>
        <div className="border border-black p-3 bg-gray-50 text-center">
          <div className="font-bold text-gray-500 uppercase text-[10px]">Total Order Weight</div>
          <div className="text-xl font-bold">{jobCard.totalWeight} Kg</div>
        </div>
      </div>

      {/* ALLOCATED REELS */}
      {jobCard.allocations && jobCard.allocations.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-sm uppercase mb-2 bg-gray-100 p-1 border-y border-black">Allocated Reels Summary</h3>
          <table className="w-full text-left border-collapse border border-black">
            <thead>
              <tr className="bg-gray-50 text-xs">
                <th className="border border-black p-1.5 w-1/2">Reel Number</th>
                <th className="border border-black p-1.5 w-1/4 text-right">Allocated Weight</th>
                <th className="border border-black p-1.5 w-1/4 text-right">Allocated On</th>
              </tr>
            </thead>
            <tbody>
              {jobCard.allocations.map((a: any, idx: number) => (
                <tr key={idx}>
                  <td className="border border-black p-1.5 font-bold">{a.reelNumber}</td>
                  <td className="border border-black p-1.5 text-right font-bold">{a.allocatedWeight} Kg</td>
                  <td className="border border-black p-1.5 text-right text-[10px]">{new Date(a.allocatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* INSTRUCTIONS & SIGNATURES */}
      <div className="border border-black p-4 mb-8 min-h-[100px] break-inside-avoid">
        <h3 className="font-bold text-sm mb-2">Remarks / Special Instructions:</h3>
        <p className="whitespace-pre-wrap">{jobCard.remarks || 'None'}</p>
      </div>

      <div className="grid grid-cols-3 gap-8 mt-16 pt-8 text-center text-gray-600 font-bold uppercase text-[10px] break-inside-avoid">
        <div className="border-t border-black pt-2">Prepared By</div>
        <div className="border-t border-black pt-2">Production Head</div>
        <div className="border-t border-black pt-2">QC Approval</div>
      </div>
      
    </div>
  );
}
