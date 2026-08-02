import React from 'react';

export default function PrintableJobCard({ jobCard }: { jobCard: any }) {
  if (!jobCard) return null;
  const product = jobCard.productSnapshot;
  const loggedInUser = jobCard.createdBy || 'System';

  return (
    <div id="job-card-print-area" className="w-[210mm] mx-auto bg-white text-black p-[15mm] text-[12px] font-sans leading-snug">
      
      {/* HEADER */}
      <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-200 border border-gray-400 flex items-center justify-center font-bold text-gray-500">
             LOGO
          </div>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider mb-0.5">Production Job Card</h1>
            <p className="font-semibold text-gray-700">PACKWELL INDUSTRIES</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold mb-1">{jobCard.jobCardNo}</div>
          <div className="text-xs font-bold text-gray-600 mb-1">Document No.: F/QA/016</div>
          <div className="text-xs">Date: <span className="font-semibold">{new Date(jobCard.targetDate || jobCard.createdAt).toLocaleDateString()}</span></div>
        </div>
      </div>

      {/* PRODUCT + DIMENSIONS */}
      <div className="mb-4 bg-gray-100 border border-black p-3 text-center">
        <div className="text-xl font-extrabold uppercase">{jobCard.productName}</div>
        <div className="text-sm font-bold text-gray-700 mt-1">
          {product?.length}" (L) x {product?.width}" (W) x {product?.height}" (H)
        </div>
      </div>

      {/* REQUIRED PRINT SEQUENCE */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4 border border-black p-3">
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">1. Reel Size:</span>
          <span className="font-bold">{product?.reelSize}"</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">2. Cut Size:</span>
          <span className="font-bold">{product?.cutSize}"</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">3. Paper Quantity:</span>
          <span className="font-bold">{jobCard.paperQuantity || '-'} Sheets</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">4. Ply Quantity:</span>
          <span className="font-bold">{jobCard.plyQuantity || '-'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">5. Ply & Flute:</span>
          <span className="font-bold">{product?.ply} Ply / '{product?.flute}' Flute</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">6. Color:</span>
          <span className="font-bold uppercase">{product?.color || 'Plain'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">7. Creasing:</span>
          <span className="font-bold uppercase">{product?.creasing || '-'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">8. Die Number:</span>
          <span className="font-bold uppercase">{product?.creasing === 'DIE' ? (product?.dieNo || '-') : 'N/A'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">9. UPS:</span>
          <span className="font-bold">{product?.ups || 1}</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">10. Pin / Pasting:</span>
          <span className="font-bold uppercase">{product?.jointType || '-'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">11. Pin Type:</span>
          <span className="font-bold uppercase">{product?.jointType === 'PIN' ? (product?.pinType || '-') : 'N/A'}</span>
        </div>
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span className="font-bold text-gray-600">12. Pin Quantity:</span>
          <span className="font-bold uppercase">{product?.jointType === 'PIN' ? (product?.pinQty || '-') : 'N/A'}</span>
        </div>
      </div>

      {/* PAPER SPECIFICATIONS */}
      <div className="mb-4">
        <h3 className="font-bold text-xs uppercase mb-1 bg-gray-100 p-1 border-y border-black">Paper Specifications</h3>
        <table className="w-full text-left border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-black p-1">Layer</th>
              <th className="border border-black p-1">Paper Type</th>
              <th className="border border-black p-1">BF</th>
              <th className="border border-black p-1">GSM</th>
              <th className="border border-black p-1 text-right">Required Weight</th>
            </tr>
          </thead>
          <tbody>
            {(product?.layers || []).map((layer: any, idx: number) => (
              <tr key={idx}>
                <td className="border border-black p-1 font-bold">{layer.layerName}</td>
                <td className="border border-black p-1">{layer.paperType}</td>
                <td className="border border-black p-1">{layer.bf}</td>
                <td className="border border-black p-1 font-semibold">{layer.gsm}</td>
                <td className="border border-black p-1 text-right font-bold">{layer.calculatedWeight || layer.weight || 0} Kg</td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold">
              <td colSpan={4} className="border border-black p-1 text-right">Total Paper Weight:</td>
              <td className="border border-black p-1 text-right">{jobCard.totalWeight || 0} Kg</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* REEL ALLOCATION */}
      {(jobCard.allocations && jobCard.allocations.length > 0) ? (
        <div className="mb-4">
          <h3 className="font-bold text-xs uppercase mb-1 bg-gray-100 p-1 border-y border-black">Allocated Reels</h3>
          <table className="w-full text-left border-collapse border border-black text-[11px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-black p-1">Reel Number</th>
                <th className="border border-black p-1 text-right">Allocated Weight</th>
              </tr>
            </thead>
            <tbody>
              {jobCard.allocations.map((a: any, idx: number) => (
                <tr key={idx}>
                  <td className="border border-black p-1 font-bold">{a.reelNumber}</td>
                  <td className="border border-black p-1 text-right font-bold">{a.allocatedWeight} Kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
         <div className="mb-4 text-[11px] italic text-gray-500">No reels allocated yet.</div>
      )}

      {/* PRODUCTION DEPARTMENT & SIGNATURES */}
      <div className="mb-4">
        <h3 className="font-bold text-xs uppercase mb-1 bg-gray-100 p-1 border-y border-black">Production Tracker</h3>
        <table className="w-full text-left border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-black p-2 w-[25%]">Department</th>
              <th className="border border-black p-2 w-[20%]">Production Quantity</th>
              <th className="border border-black p-2 w-[30%]">Operator Name</th>
              <th className="border border-black p-2 w-[25%]">Signature</th>
            </tr>
          </thead>
          <tbody>
            {['Corrugation M/C', 'Paper Cutting M/C', 'Pasting M/C', 'Rotary / Die M/C', 'RS4 M/C', 'FG'].map((dept, i) => (
              <tr key={i}>
                <td className="border border-black p-3 font-bold">{dept}</td>
                <td className="border border-black p-3"></td>
                <td className="border border-black p-3"></td>
                <td className="border border-black p-3"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* INSTRUCTIONS */}
      {(jobCard.remarks || jobCard.specialInstructions) && (
        <div className="mb-6 p-2 border border-black min-h-[40px]">
          <h3 className="font-bold text-xs mb-1">Remarks / Special Instructions:</h3>
          <p className="text-[11px] whitespace-pre-wrap">{jobCard.remarks || jobCard.specialInstructions}</p>
        </div>
      )}

      {/* PREPARED / CHECKED / PRODUCTION HEAD */}
      <div className="grid grid-cols-3 gap-8 mt-12 pt-6 text-center text-gray-800 font-bold uppercase text-[10px] break-inside-avoid">
        <div className="border-t border-black pt-1">
          Prepared By<br/>
          <span className="font-normal text-[11px] capitalize">{loggedInUser}</span>
        </div>
        <div className="border-t border-black pt-1">Checked By</div>
        <div className="border-t border-black pt-1">Production Head</div>
      </div>
      
    </div>
  );
}
