import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X, FileSpreadsheet, Upload, Download, CheckCircle2,
  AlertTriangle, Loader2, ArrowDownToLine, Truck, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { executeFinishGoodInwardTransaction, executeFinishGoodOutwardTransaction } from '../../lib/firebase/services';
import { getProducts } from '../../lib/supabase/productService';
import type { FinishGoodInwardPayload, FinishGoodOutwardPayload, LogisticsPayload } from '../../lib/firebase/services';

// ─── Types ───────────────────────────────────────────────────────────────────

type FGRowParsed = {
  _rowNum: number;
  date: string;
  type: 'IN' | 'OUT';
  artworkNo: string;
  category: string;
  openingBalance: number;
  rate: number;
  quantity: number;
  invoiceNo: string;
  // resolved after matching
  productId?: string;
  productName?: string;
  customerId?: string;
  customerName?: string;
  _status: 'OK' | 'ERROR' | 'WARN';
  _error?: string;
};

type FreightRowParsed = {
  _rowNum: number;
  date: string;
  invoiceNo: string;
  customerName: string;
  place: string;
  transporterName: string;
  vehicleNo: string;
  vehicleSize: string;
  freight: number;
  holding: number;
  point: number;
  others: number;
  _status: 'OK' | 'WARN';
};

// ─── Helper: parse Excel date serial or string ────────────────────────────────
function parseExcelDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const mm = String(d.m).padStart(2, '0');
      const dd = String(d.d).padStart(2, '0');
      return `${d.y}-${mm}-${dd}`;
    }
  }
  // string like DD-MM-YYYY or DD/MM/YYYY
  const str = String(val).trim();
  const parts = str.split(/[-\/]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c.length === 4) {
      // DD-MM-YYYY
      return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`;
    }
    // YYYY-MM-DD already
    return str;
  }
  return str;
}

function safeNum(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// ─── Generate Template ────────────────────────────────────────────────────────
function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: FinishGoods ──
  const fgHeaders = [
    'Date (DD-MM-YYYY)',
    'Type (IN/OUT)',
    'Artwork No',
    'Category',
    'Opening Balance',
    'Rate (₹)',
    'Quantity',
    'Invoice No (OUT only)',
  ];

  const fgSample = [
    ['01-08-2026', 'IN',  'AW-001', 'REGULAR',   500, 12.50, 200, ''],
    ['01-08-2026', 'IN',  'AW-002', 'REGULAR',   300,  8.00, 100, ''],
    ['02-08-2026', 'OUT', 'AW-001', 'DISPATCH',  '',  12.50, 150, 'INV-001'],
    ['03-08-2026', 'IN',  'AW-003', 'REJECTED',  0,    5.00,  50, ''],
    ['05-08-2026', 'OUT', 'AW-002', 'DISPATCH',  '',   8.00,  80, 'INV-002'],
  ];

  const fgWS = XLSX.utils.aoa_to_sheet([fgHeaders, ...fgSample]);

  // Column widths
  fgWS['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, fgWS, 'FinishGoods');

  // ── Sheet 2: FreightCharges ──
  const frHeaders = [
    'Date (DD-MM-YYYY)',
    'Invoice No',
    'Customer Name',
    'Place',
    'Transporter Name',
    'Vehicle No',
    'Vehicle Size',
    'Freight (₹)',
    'Holding (₹)',
    'Point (₹)',
    'Others (₹)',
  ];

  const frSample = [
    ['02-08-2026', 'INV-001', 'ABC Ltd',  'Mumbai', 'Sharma Transport', 'MH-04-AB-1234', '20FT', 5000, 500, 200, 0],
    ['05-08-2026', 'INV-002', 'XYZ Corp', 'Pune',   'Gupta Transport',  'MH-12-CD-5678', '32FT', 8000, 0,   300, 100],
  ];

  const frWS = XLSX.utils.aoa_to_sheet([frHeaders, ...frSample]);
  frWS['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
    { wch: 20 }, { wch: 16 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, frWS, 'FreightCharges');

  // ── Sheet 3: Instructions ──
  const instrData = [
    ['📋 INSTRUCTIONS — FinishGoods + FreightCharges Import'],
    [''],
    ['SHEET 1: FinishGoods'],
    ['Column', 'Description', 'Valid Values'],
    ['Date', 'Transaction date', 'DD-MM-YYYY format, e.g. 01-08-2026'],
    ['Type', 'IN = goods received, OUT = goods dispatched', 'IN  or  OUT  (capital)'],
    ['Artwork No', 'Exact artwork number from Master Data', 'e.g. AW-001'],
    ['Category', 'Type of stock movement', 'IN: REGULAR or REJECTED | OUT: DISPATCH or NON-MOVING'],
    ['Opening Balance', 'Starting stock (only for first IN of a product)', 'Number, e.g. 500  — leave blank for subsequent entries'],
    ['Rate (₹)', 'Per unit rate', 'Number, e.g. 12.50'],
    ['Quantity', 'Number of units', 'Positive number'],
    ['Invoice No', 'For OUT rows only — links to FreightCharges sheet', 'e.g. INV-001'],
    [''],
    ['SHEET 2: FreightCharges'],
    ['Column', 'Description'],
    ['Date', 'Same date as OUT transaction'],
    ['Invoice No', 'Must match Invoice No in FinishGoods OUT rows'],
    ['Customer Name', 'Customer name'],
    ['Place', 'Delivery destination'],
    ['Transporter Name', 'Transporter/carrier name'],
    ['Vehicle No', 'Vehicle registration number'],
    ['Vehicle Size', 'e.g. 20FT, 32FT, MINI'],
    ['Freight (₹)', 'Freight charges'],
    ['Holding (₹)', 'Holding charges'],
    ['Point (₹)', 'Point charges'],
    ['Others (₹)', 'Any other charges'],
    [''],
    ['⚠️ IMPORTANT NOTES'],
    ['1. Artwork No must exactly match what is in Master Data of the web app'],
    ['2. Opening Balance — fill only for first entry of a product, leave blank for all other rows'],
    ['3. Date format must be DD-MM-YYYY'],
    ['4. Type and Category must be in CAPITAL letters'],
    ['5. OUT rows without freight — leave FreightCharges sheet blank for that Invoice No'],
  ];

  const instrWS = XLSX.utils.aoa_to_sheet(instrData);
  instrWS['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, instrWS, 'Instructions');

  XLSX.writeFile(wb, 'FinishGoods_FreightCharges_Template.xlsx');
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExcelImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [fgRows, setFgRows] = useState<FGRowParsed[]>([]);
  const [freightRows, setFreightRows] = useState<FreightRowParsed[]>([]);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [importError, setImportError] = useState('');
  const [fileName, setFileName] = useState('');
  const [showFG, setShowFG] = useState(true);
  const [showFreight, setShowFreight] = useState(true);

  // ── Parse Excel File ──────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });

        // Fetch products from DB for matching
        const products: any[] = await getProducts();

        // ── Parse FinishGoods Sheet ──
        const fgSheet = wb.Sheets['FinishGoods'] || wb.Sheets[wb.SheetNames[0]];
        const fgRaw: any[][] = XLSX.utils.sheet_to_json(fgSheet, { header: 1, defval: '' });

        const parsedFG: FGRowParsed[] = [];
        for (let i = 1; i < fgRaw.length; i++) {
          const row = fgRaw[i];
          if (!row || row.every((c: any) => c === '' || c === null || c === undefined)) continue;

          const dateStr   = parseExcelDate(row[0]);
          const typeRaw   = String(row[1] || '').trim().toUpperCase();
          const artworkNo = String(row[2] || '').trim();
          const catRaw    = String(row[3] || '').trim().toUpperCase();
          const openingBal= safeNum(row[4]);
          const rate      = safeNum(row[5]);
          const qty       = safeNum(row[6]);
          const invoiceNo = String(row[7] || '').trim();

          // Validate type
          if (typeRaw !== 'IN' && typeRaw !== 'OUT') {
            parsedFG.push({
              _rowNum: i + 1, date: dateStr, type: 'IN', artworkNo, category: catRaw,
              openingBalance: openingBal, rate, quantity: qty, invoiceNo,
              _status: 'ERROR', _error: `Type must be IN or OUT, got: "${row[1]}"`
            });
            continue;
          }

          // Match product by artworkNo
          const product = products.find(
            (p: any) => (p.artworkNo || '').trim().toLowerCase() === artworkNo.toLowerCase()
          );

          // Validate category
          const validCatsIN  = ['REGULAR', 'REJECTED'];
          const validCatsOUT = ['DISPATCH', 'NON-MOVING'];
          const validCats    = typeRaw === 'IN' ? validCatsIN : validCatsOUT;

          let status: 'OK' | 'ERROR' | 'WARN' = 'OK';
          let error = '';

          if (!artworkNo) {
            status = 'ERROR'; error = 'Artwork No is required';
          } else if (!product) {
            status = 'ERROR'; error = `Product not found for Artwork No: "${artworkNo}"`;
          } else if (!validCats.includes(catRaw)) {
            status = 'ERROR';
            error = `Invalid Category "${catRaw}" for ${typeRaw}. Use: ${validCats.join(' or ')}`;
          } else if (qty <= 0) {
            status = 'ERROR'; error = 'Quantity must be > 0';
          } else if (!dateStr) {
            status = 'ERROR'; error = 'Date is required';
          } else if (typeRaw === 'OUT' && !invoiceNo) {
            status = 'WARN'; error = 'No Invoice No for OUT row — Freight will not be linked';
          }

          parsedFG.push({
            _rowNum: i + 1, date: dateStr,
            type: typeRaw as 'IN' | 'OUT',
            artworkNo, category: catRaw,
            openingBalance: openingBal, rate, quantity: qty, invoiceNo,
            productId: product?.id,
            productName: product?.itemName || product?.artworkNo || '',
            customerId: product?.customerId || '',
            customerName: product?.customerName || '',
            _status: status, _error: error || undefined
          });
        }

        // ── Parse FreightCharges Sheet ──
        const frSheet = wb.Sheets['FreightCharges'] || wb.Sheets[wb.SheetNames[1]];
        const parsedFR: FreightRowParsed[] = [];

        if (frSheet) {
          const frRaw: any[][] = XLSX.utils.sheet_to_json(frSheet, { header: 1, defval: '' });
          for (let i = 1; i < frRaw.length; i++) {
            const row = frRaw[i];
            if (!row || row.every((c: any) => c === '' || c === null || c === undefined)) continue;
            parsedFR.push({
              _rowNum: i + 1,
              date:            parseExcelDate(row[0]),
              invoiceNo:       String(row[1] || '').trim(),
              customerName:    String(row[2] || '').trim(),
              place:           String(row[3] || '').trim(),
              transporterName: String(row[4] || '').trim(),
              vehicleNo:       String(row[5] || '').trim(),
              vehicleSize:     String(row[6] || '').trim(),
              freight:         safeNum(row[7]),
              holding:         safeNum(row[8]),
              point:           safeNum(row[9]),
              others:          safeNum(row[10]),
              _status: 'OK',
            });
          }
        }

        setFgRows(parsedFG);
        setFreightRows(parsedFR);
        setStep('preview');
      } catch (err: any) {
        alert('File parse error: ' + (err?.message || 'Unknown error'));
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Submit Import ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    setStep('importing');
    setImportLog([]);
    setImportError('');
    const log: string[] = [];

    try {
      const userName = user?.name || 'System';

      // ─ Group IN rows by date ─
      const inRows    = fgRows.filter(r => r.type === 'IN'  && r._status !== 'ERROR');
      const outRows   = fgRows.filter(r => r.type === 'OUT' && r._status !== 'ERROR');

      // ─ Process Opening Balance adjustments for IN rows ─
      // For products with opening balance > 0 on first IN, we create an OPENING entry first
      // Then add the IN quantity

      // Group IN rows by date for batch processing
      const inByDate = new Map<string, typeof inRows>();
      for (const r of inRows) {
        const existing = inByDate.get(r.date) || [];
        existing.push(r);
        inByDate.set(r.date, existing);
      }

      // Process each date's IN batch
      for (const [date, rows] of inByDate) {
        log.push(`📥 Processing IN for date: ${date} (${rows.length} rows)...`);
        setImportLog([...log]);

        // Build payloads
        const payloads: FinishGoodInwardPayload[] = [];

        for (const r of rows) {
          // If opening balance > 0, we need to set it first via a separate "OPENING" IN
          if (r.openingBalance > 0) {
            // Add opening balance as a separate IN entry
            payloads.push({
              productId:    r.productId!,
              productName:  r.productName!,
              customerId:   r.customerId!,
              customerName: r.customerName!,
              quantity:     r.openingBalance,
              category:     r.category === 'REJECTED' ? 'REJECTED' : 'REGULAR',
              date:         r.date,
              rate:         r.rate,
            });
            log.push(`   ↳ Opening Balance: ${r.artworkNo} — ${r.openingBalance} qty`);
          }

          // Add the actual IN quantity
          if (r.quantity > 0) {
            payloads.push({
              productId:    r.productId!,
              productName:  r.productName!,
              customerId:   r.customerId!,
              customerName: r.customerName!,
              quantity:     r.quantity,
              category:     r.category === 'REJECTED' ? 'REJECTED' : 'REGULAR',
              date:         r.date,
              rate:         r.rate,
            });
            log.push(`   ↳ IN: ${r.artworkNo} — ${r.quantity} qty @ ₹${r.rate}`);
          }
        }

        if (payloads.length > 0) {
          await executeFinishGoodInwardTransaction(payloads, userName);
          log.push(`   ✅ IN batch for ${date} done.`);
        }
        setImportLog([...log]);
      }

      // ─ Group OUT rows by invoice ─
      const outByInvoice = new Map<string, typeof outRows>();
      for (const r of outRows) {
        const key = r.invoiceNo || `__NO_INV_${r._rowNum}`;
        const existing = outByInvoice.get(key) || [];
        existing.push(r);
        outByInvoice.set(key, existing);
      }

      // Build freight map
      const freightMap = new Map<string, FreightRowParsed>();
      for (const fr of freightRows) {
        if (fr.invoiceNo) freightMap.set(fr.invoiceNo, fr);
      }

      // Process each invoice's OUT batch
      for (const [invoiceKey, rows] of outByInvoice) {
        const firstRow   = rows[0];
        const frData     = freightMap.get(invoiceKey);
        const invoiceNo  = invoiceKey.startsWith('__NO_INV_') ? '' : invoiceKey;

        log.push(`📤 Processing OUT Invoice: ${invoiceNo || '(no invoice)'} (${rows.length} rows)...`);
        setImportLog([...log]);

        const logistics: LogisticsPayload = {
          date:            firstRow.date,
          invoiceNo:       invoiceNo,
          place:           frData?.place           || '',
          transporterName: frData?.transporterName || '',
          vehicleNo:       frData?.vehicleNo       || '',
          vehicleSize:     frData?.vehicleSize      || '',
          freight:         frData?.freight          || 0,
          holding:         frData?.holding          || 0,
          point:           String(frData?.point     || 0),
          others:          String(frData?.others    || 0),
        };

        const payloads: FinishGoodOutwardPayload[] = rows.map(r => ({
          productId: r.productId!,
          quantity:  r.quantity,
          category:  (r.category === 'NON-MOVING' ? 'NON-MOVING' : 'DISPATCH') as 'DISPATCH' | 'NON-MOVING',
        }));

        try {
          await executeFinishGoodOutwardTransaction(logistics, payloads, userName);
          log.push(`   ✅ OUT batch done — Invoice: ${invoiceNo || 'N/A'}`);
          if (frData) {
            log.push(`   🚚 Freight linked — Transporter: ${frData.transporterName}, ₹${frData.freight}`);
          }
        } catch (err: any) {
          log.push(`   ❌ OUT failed: ${err?.message || 'Unknown error'}`);
        }
        setImportLog([...log]);
      }

      log.push('');
      log.push('🎉 Import Complete!');
      setImportLog([...log]);
      setStep('done');
    } catch (err: any) {
      setImportError(err?.message || 'Import failed. Check console.');
      setStep('preview');
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const fgOK    = fgRows.filter(r => r._status === 'OK').length;
  const fgWarn  = fgRows.filter(r => r._status === 'WARN').length;
  const fgErr   = fgRows.filter(r => r._status === 'ERROR').length;
  const hasErrors = fgErr > 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3">
      <div className="bg-card w-full max-w-6xl max-h-[95vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-border">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/10 to-primary/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Excel Bulk Import</h2>
              <p className="text-xs text-muted-foreground">Finish Goods (IN/OUT) + Freight Charges</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">

          {/* ── STEP: UPLOAD ── */}
          {step === 'upload' && (
            <div className="p-8 flex flex-col items-center gap-6">

              {/* Template Download Card */}
              <div className="w-full max-w-2xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-emerald-100 dark:bg-emerald-800/50 p-3 rounded-lg shrink-0">
                    <Download className="w-7 h-7 text-emerald-700 dark:text-emerald-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-100 mb-1">
                      Step 1 — Template Download Karo
                    </h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4">
                      Ready-made Excel template milegi — 2 sheets hogi:
                      <strong> FinishGoods</strong> (IN/OUT + Opening Balance) aur
                      <strong> FreightCharges</strong>. Sample data bhi hoga guide ke liye.
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      Template Download (.xlsx)
                    </button>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="w-full max-w-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <p className="font-bold mb-2">📋 Excel Format — Quick Guide:</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <div><strong>Sheet 1: FinishGoods</strong></div>
                      <div><strong>Sheet 2: FreightCharges</strong></div>
                      <div>• Date: DD-MM-YYYY</div>
                      <div>• Date: DD-MM-YYYY</div>
                      <div>• Type: IN / OUT</div>
                      <div>• Invoice No (OUT se link)</div>
                      <div>• Artwork No (exact)</div>
                      <div>• Transporter, Vehicle</div>
                      <div>• Category: REGULAR/REJECTED (IN)</div>
                      <div>• Freight, Holding, Point</div>
                      <div>• Category: DISPATCH/NON-MOVING (OUT)</div>
                      <div>• Others charges</div>
                      <div>• Opening Balance (sirf pehli entry)</div>
                      <div></div>
                      <div>• Rate (₹) + Quantity</div>
                      <div></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Zone */}
              <div className="w-full max-w-2xl">
                <h3 className="text-base font-bold text-foreground mb-3">
                  Step 2 — Filled Excel Upload Karo
                </h3>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-primary/40 hover:border-primary rounded-xl p-10 text-center cursor-pointer transition-all hover:bg-primary/5 group"
                >
                  <Upload className="w-12 h-12 mx-auto mb-3 text-primary/50 group-hover:text-primary transition-colors" />
                  <p className="text-base font-semibold text-foreground mb-1">
                    Click here ya drag & drop karo
                  </p>
                  <p className="text-sm text-muted-foreground">
                    .xlsx ya .xls file — FinishGoods + FreightCharges sheets
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === 'preview' && (
            <div className="p-4 space-y-4">

              {/* File info bar */}
              <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2.5 border border-border">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  <span className="truncate max-w-xs">{fileName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    ✅ {fgOK} Ready
                  </span>
                  {fgWarn > 0 && (
                    <span className="text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      ⚠️ {fgWarn} Warning
                    </span>
                  )}
                  {fgErr > 0 && (
                    <span className="text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      ❌ {fgErr} Error
                    </span>
                  )}
                  <span className="text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    🚚 {freightRows.length} Freight
                  </span>
                </div>
              </div>

              {importError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {importError}
                </div>
              )}

              {hasErrors && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {fgErr} rows me errors hain — unhe fix karo ya woh rows skip honge (warn rows import honge).
                </div>
              )}

              {/* FinishGoods Table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-secondary/50 hover:bg-secondary transition-colors text-sm font-bold text-foreground"
                  onClick={() => setShowFG(v => !v)}
                >
                  <div className="flex items-center gap-2">
                    <ArrowDownToLine className="w-4 h-4 text-primary" />
                    Finish Goods Preview ({fgRows.length} rows)
                  </div>
                  {showFG ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showFG && (
                  <div className="overflow-auto max-h-72">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                          {['Row','Date','Type','Artwork No','Category','Op.Bal','Rate','Qty','Invoice No','Product Name','Customer','Status'].map(h => (
                            <th key={h} className="px-3 py-2 font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {fgRows.map(row => (
                          <tr
                            key={row._rowNum}
                            className={
                              row._status === 'ERROR' ? 'bg-red-50/60 dark:bg-red-900/10' :
                              row._status === 'WARN'  ? 'bg-amber-50/60 dark:bg-amber-900/10' :
                              'bg-card hover:bg-muted/30'
                            }
                          >
                            <td className="px-3 py-2 text-muted-foreground font-mono">{row._rowNum}</td>
                            <td className="px-3 py-2 whitespace-nowrap font-medium">{row.date}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                row.type === 'IN'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-orange-50 text-orange-700 border-orange-200'
                              }`}>{row.type}</span>
                            </td>
                            <td className="px-3 py-2 font-mono">{row.artworkNo}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{row.category}</td>
                            <td className="px-3 py-2 text-right">{row.openingBalance || '-'}</td>
                            <td className="px-3 py-2 text-right">₹{row.rate}</td>
                            <td className="px-3 py-2 text-right font-bold">{row.quantity}</td>
                            <td className="px-3 py-2 font-mono text-xs">{row.invoiceNo || '-'}</td>
                            <td className="px-3 py-2 max-w-[120px] truncate" title={row.productName}>{row.productName || '—'}</td>
                            <td className="px-3 py-2 max-w-[100px] truncate" title={row.customerName}>{row.customerName || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {row._status === 'ERROR' ? (
                                <span className="text-red-600 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span title={row._error} className="cursor-help underline decoration-dotted">ERROR</span>
                                </span>
                              ) : row._status === 'WARN' ? (
                                <span className="text-amber-600 font-semibold flex items-center gap-1" title={row._error}>
                                  ⚠️ WARN
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> OK
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* FreightCharges Table */}
              {freightRows.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-secondary/50 hover:bg-secondary transition-colors text-sm font-bold text-foreground"
                    onClick={() => setShowFreight(v => !v)}
                  >
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600" />
                      Freight Charges Preview ({freightRows.length} rows)
                    </div>
                    {showFreight ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showFreight && (
                    <div className="overflow-auto max-h-60">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/50 sticky top-0 z-10">
                          <tr>
                            {['Row','Date','Invoice No','Customer','Place','Transporter','Vehicle No','Size','Freight','Holding','Point','Others'].map(h => (
                              <th key={h} className="px-3 py-2 font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {freightRows.map(row => (
                            <tr key={row._rowNum} className="bg-card hover:bg-muted/30">
                              <td className="px-3 py-2 text-muted-foreground font-mono">{row._rowNum}</td>
                              <td className="px-3 py-2 whitespace-nowrap font-medium">{row.date}</td>
                              <td className="px-3 py-2 font-mono font-bold text-primary">{row.invoiceNo}</td>
                              <td className="px-3 py-2">{row.customerName}</td>
                              <td className="px-3 py-2">{row.place}</td>
                              <td className="px-3 py-2">{row.transporterName}</td>
                              <td className="px-3 py-2 font-mono">{row.vehicleNo}</td>
                              <td className="px-3 py-2">{row.vehicleSize}</td>
                              <td className="px-3 py-2 text-right font-medium">₹{row.freight}</td>
                              <td className="px-3 py-2 text-right">₹{row.holding}</td>
                              <td className="px-3 py-2 text-right">₹{row.point}</td>
                              <td className="px-3 py-2 text-right">₹{row.others}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: IMPORTING ── */}
          {step === 'importing' && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <h3 className="text-base font-bold text-foreground">Import chal raha hai...</h3>
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-4 font-mono text-xs space-y-1 max-h-72 overflow-auto">
                {importLog.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.includes('✅') ? 'text-emerald-600' :
                      line.includes('❌') ? 'text-red-600' :
                      line.includes('⚠️') ? 'text-amber-600' :
                      line.includes('🎉') ? 'text-primary font-bold text-sm' :
                      'text-muted-foreground'
                    }
                  >
                    {line || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div className="p-10 flex flex-col items-center gap-6 text-center">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-5 rounded-full">
                <CheckCircle2 className="w-14 h-14 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-foreground mb-2">Import Successful! 🎉</h3>
                <p className="text-muted-foreground">
                  Finish Goods aur Freight Charges data successfully import ho gaya.
                </p>
              </div>
              <div className="bg-muted/30 border border-border rounded-xl p-4 font-mono text-xs space-y-1 max-h-52 overflow-auto w-full max-w-xl text-left">
                {importLog.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.includes('✅') ? 'text-emerald-600' :
                      line.includes('❌') ? 'text-red-600' :
                      line.includes('🎉') ? 'text-primary font-bold' :
                      'text-muted-foreground'
                    }
                  >
                    {line || '\u00A0'}
                  </div>
                ))}
              </div>
              <button
                onClick={() => { onSuccess(); onClose(); }}
                className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold text-base shadow-lg hover:bg-primary/90 transition-all"
              >
                Done — Page Refresh Karo
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'upload' || step === 'preview') && (
          <div className="px-6 py-4 border-t border-border bg-card shrink-0 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>

            {step === 'preview' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setStep('upload'); setFgRows([]); setFreightRows([]); setFileName(''); }}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
                >
                  ← Dobara Upload
                </button>
                <button
                  onClick={handleImport}
                  disabled={fgOK + fgWarn === 0}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  Import Karo ({fgOK + fgWarn} rows + {freightRows.length} freight)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
