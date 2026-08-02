import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, CheckCircle2, CircleDashed, FileText, X, Edit, Printer } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { cn } from '../lib/utils';
import { queryDocuments, createDocument, updateDocument } from '../lib/firebase/services';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { exportToExcel, exportToPDF } from '../lib/exportUtils';
import PrintableJobCard from './job-cards/PrintableJobCard';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ReelAllocationModal from './job-cards/ReelAllocationModal';
import IssueJobCardModal from './job-cards/IssueJobCardModal';
import ExportButtons from '../components/ExportButtons';
import { Layers, Play } from 'lucide-react';

export default function JobCards() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingJobCard, setEditingJobCard] = useState<any>(null);
  const [printingJobCard, setPrintingJobCard] = useState<any>(null);
  const [allocatingJobCard, setAllocatingJobCard] = useState<any>(null);
  const [issuingJobCard, setIssuingJobCard] = useState<any>(null);

  // 3-way smart search state (Inputs)
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [searchJC, setSearchJC] = useState('');

  // Applied search state (Triggered by Search button)
  const [appliedSearchCustomer, setAppliedSearchCustomer] = useState('');
  const [appliedSearchProduct, setAppliedSearchProduct] = useState('');
  const [appliedSearchJC, setAppliedSearchJC] = useState('');

  const { data: jobCards = [], isLoading: loadingCards, refetch: refetchCards } = useQuery({
    queryKey: ['jobcards'],
    queryFn: async () => {
      const data = await queryDocuments('jobCards', []) as any[];
      return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });

  // Smart Relational Filtering + Status Ordering
  const filteredCards = useMemo(() => {
    let list = jobCards.filter(jc => {
      const matchC = (jc.customerName || '').toLowerCase().includes(appliedSearchCustomer.toLowerCase());
      const matchP = (jc.productName || '').toLowerCase().includes(appliedSearchProduct.toLowerCase());
      const matchJ = (jc.jobCardNo || '').toLowerCase().includes(appliedSearchJC.toLowerCase());
      return matchC && matchP && matchJ;
    });

    const statusWeight: Record<string, number> = {
      'PENDING': 1,
      'ISSUED': 2,
      'IN-PROCESS': 2,
      'COMPLETED': 3
    };

    list.sort((a, b) => {
      const weightA = statusWeight[a.status] || 99;
      const weightB = statusWeight[b.status] || 99;
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [jobCards, appliedSearchCustomer, appliedSearchProduct, appliedSearchJC]);

  // Dynamic Datalists (Narrowed based on other filters)
  const uniqueCustomers = useMemo(() => {
    const list = jobCards.filter(jc => 
      (jc.productName || '').toLowerCase().includes(searchProduct.toLowerCase()) &&
      (jc.jobCardNo || '').toLowerCase().includes(searchJC.toLowerCase())
    );
    return Array.from(new Set(list.map(j => j.customerName))).filter(Boolean) as string[];
  }, [jobCards, searchProduct, searchJC]);

  const uniqueProducts = useMemo(() => {
    const list = jobCards.filter(jc => 
      (jc.customerName || '').toLowerCase().includes(searchCustomer.toLowerCase()) &&
      (jc.jobCardNo || '').toLowerCase().includes(searchJC.toLowerCase())
    );
    return Array.from(new Set(list.map(j => j.productName))).filter(Boolean) as string[];
  }, [jobCards, searchCustomer, searchJC]);

  const uniqueJCs = useMemo(() => {
    const list = jobCards.filter(jc => 
      (jc.customerName || '').toLowerCase().includes(searchCustomer.toLowerCase()) &&
      (jc.productName || '').toLowerCase().includes(searchProduct.toLowerCase())
    );
    return Array.from(new Set(list.map(j => j.jobCardNo))).filter(Boolean) as string[];
  }, [jobCards, searchCustomer, searchProduct]);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('job-card-print-area');
    if (!element) return;
    
    // Optional: Add a loading state here if generation is slow
    const originalStyle = element.style.cssText;
    
    try {
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`JobCard_${printingJobCard?.jobCardNo}.pdf`);
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('Failed to generate PDF automatically. You can still use Print -> Save as PDF.');
    } finally {
      element.style.cssText = originalStyle;
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* --- PRINT PREVIEW OVERLAY --- */}
      {printingJobCard && (
        <div className="fixed inset-0 z-[100] bg-gray-900 overflow-auto flex flex-col">
          <div className="p-4 bg-gray-800 text-white flex justify-between items-center shadow-lg sticky top-0 z-10 shrink-0 no-print">
            <div>
              <h2 className="text-xl font-bold text-white">Print Preview</h2>
              <p className="text-sm text-gray-400">Review layout before printing.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleDownloadPDF} 
                className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-md text-sm font-bold flex items-center shadow transition-colors text-primary-foreground"
              >
                Download as PDF
              </button>
              <button 
                onClick={() => window.print()} 
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm font-bold flex items-center shadow transition-colors text-white"
              >
                Print Document
              </button>
              <button 
                onClick={() => setPrintingJobCard(null)} 
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-md text-sm font-medium transition-colors text-white"
              >
                Close Preview
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-8 overflow-y-auto flex justify-center pb-20 no-print-bg">
            <div id="job-card-print-area" className="bg-white shadow-2xl overflow-hidden print-view-container min-h-[297mm]">
              <PrintableJobCard jobCard={printingJobCard} />
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN UI (Hidden during print) --- */}
      <div className={printingJobCard ? 'hidden' : 'h-full flex flex-col'}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Job Cards</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage and track production job cards</p>
          </div>
          <div className="flex gap-3">
            <ExportButtons 
              data={filteredCards} 
              filenamePrefix="JobCards"
              title="Job Cards Report"
              columnMap={{
                'jobCardNo': 'Job Card #',
                'targetDate': 'Job Card Date',
                'customerName': 'Customer',
                'productName': 'Product',
                'orderQty': 'Order Qty',
                'status': 'Status',
                'expectedDeliveryAt': 'Delivery Deadline'
              }}
            />
            <button 
              onClick={() => { setEditingJobCard(null); setIsFormOpen(true); }}
              className="bg-primary text-primary-foreground px-4 py-2 flex items-center text-sm font-medium rounded-md shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Job Card
            </button>
          </div>
        </div>

        <div className="flex-1 bg-card border border-border shadow-sm rounded-lg overflow-hidden flex flex-col">
          {/* Smart Relational Search Bar */}
          <div className="p-4 border-b border-border bg-secondary/20 flex flex-col md:flex-row gap-4 items-end">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)}
                  placeholder="Search Customer..." 
                  list="customers-list"
                  className="pl-9 pr-4 py-2 w-full text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring shadow-sm"
                />
                <datalist id="customers-list">
                  {uniqueCustomers.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  value={searchProduct} onChange={e => setSearchProduct(e.target.value)}
                  placeholder="Search Product Name..." 
                  list="products-list"
                  className="pl-9 pr-4 py-2 w-full text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring shadow-sm"
                />
                <datalist id="products-list">
                  {uniqueProducts.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  value={searchJC} onChange={e => setSearchJC(e.target.value)}
                  placeholder="Search Job Card No..." 
                  list="jcs-list"
                  className="pl-9 pr-4 py-2 w-full text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring shadow-sm"
                />
                <datalist id="jcs-list">
                  {uniqueJCs.map(j => <option key={j} value={j} />)}
                </datalist>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setAppliedSearchCustomer(searchCustomer);
                  setAppliedSearchProduct(searchProduct);
                  setAppliedSearchJC(searchJC);
                }}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md shadow hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Search
              </button>
              <button 
                onClick={() => {
                  setSearchCustomer('');
                  setSearchProduct('');
                  setSearchJC('');
                  setAppliedSearchCustomer('');
                  setAppliedSearchProduct('');
                  setAppliedSearchJC('');
                }}
                className="px-4 py-2 bg-secondary text-secondary-foreground border border-border text-sm font-medium rounded-md shadow hover:bg-secondary/80 transition-colors whitespace-nowrap"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {loadingCards ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border sticky top-0">
                  <tr>
                    <th className="px-6 py-3 font-medium">Job Card No</th>
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-6 py-3 font-medium">Product</th>
                    <th className="px-6 py-3 font-medium text-right">Qty</th>
                    <th className="px-6 py-3 font-medium text-right">Weight</th>
                    <th className="px-6 py-3 font-medium">Target Date</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCards.map((jc: any) => (
                    <tr key={jc.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-foreground">{jc.jobCardNo}</td>
                      <td className="px-6 py-4">{jc.customerName}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{jc.productName}</div>
                        {jc.productSnapshot && (
                           <div className="text-xs text-muted-foreground mt-0.5">
                             {jc.productSnapshot.length}"x{jc.productSnapshot.width}"x{jc.productSnapshot.height}"
                           </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold">{jc.orderQty}</td>
                      <td className="px-6 py-4 text-right">{jc.totalWeight} Kg</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {jc.targetDate ? new Date(jc.targetDate).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2.5 py-1 text-xs font-bold rounded-full border", 
                          jc.status === 'COMPLETED' ? "bg-green-100 text-green-800 border-green-200" :
                          jc.status === 'IN_PROCESS' ? "bg-blue-100 text-blue-800 border-blue-200" :
                          jc.status === 'DELAYED' ? "bg-red-100 text-red-800 border-red-200" :
                          "bg-yellow-100 text-yellow-800 border-yellow-200"
                        )}>
                          {jc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {jc.status === 'PENDING' && (
                            <button 
                              onClick={() => setIssuingJobCard(jc)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md border border-transparent hover:border-blue-200 transition-colors"
                              title="Issue to Production"
                            >
                              <Play className="w-4 h-4 fill-current" />
                            </button>
                          )}
                          <button 
                            onClick={() => setAllocatingJobCard(jc)}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-md border border-transparent hover:border-orange-200 transition-colors"
                            title="Allocate Reels"
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => { setEditingJobCard(jc); setIsFormOpen(true); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md border border-transparent hover:border-blue-200 transition-colors"
                            title="Edit / View"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setPrintingJobCard(jc)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-md border border-transparent hover:border-primary/20 transition-colors"
                            title="Print / PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCards.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto text-muted mb-3" />
                        <p>No job cards found matching your filters.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {isFormOpen && (
        <JobCardModal 
          initialData={editingJobCard}
          onClose={() => { setIsFormOpen(false); setEditingJobCard(null); }} 
          onSuccess={() => {
            setIsFormOpen(false);
            setEditingJobCard(null);
            refetchCards();
          }} 
        />
      )}

      {allocatingJobCard && (
        <ReelAllocationModal 
          jobCard={allocatingJobCard}
          onClose={() => setAllocatingJobCard(null)}
          onSuccess={() => {
            setAllocatingJobCard(null);
            refetchCards();
          }}
        />
      )}

      {issuingJobCard && (
        <IssueJobCardModal 
          jobCard={issuingJobCard}
          onClose={() => setIssuingJobCard(null)}
          onSuccess={() => {
            setIssuingJobCard(null);
            refetchCards();
          }}
        />
      )}
    </div>
  );
}

function JobCardModal({ initialData, onClose, onSuccess }: { initialData?: any, onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const isEditMode = !!initialData;
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: isEditMode ? {
      jobCardNo: initialData.jobCardNo,
      targetDate: initialData.targetDate,
      customerId: initialData.customerId,
      productId: initialData.productId,
      orderQty: initialData.orderQty,
      priority: initialData.priority || 'Normal',
      remarks: initialData.remarks || ''
    } : {}
  });
  
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const data = await queryDocuments('products', []) as any[];
      return data;
    },
  });

  const [loadingNextNo, setLoadingNextNo] = useState(!isEditMode);
  const [productSearchText, setProductSearchText] = useState(() => {
    if (isEditMode && initialData) {
      return initialData.productName || '';
    }
    return '';
  });
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  useEffect(() => {
    if (isEditMode) return;

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setValue('targetDate', today);
    
    // Fetch next job card number natively from Firestore
    const fetchNextNo = async () => {
      try {
        const q = query(collection(db, 'jobCards'), orderBy('jobCardNo', 'desc'), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
          setValue('jobCardNo', 'PI/JC/1001');
        } else {
          const lastDoc = snap.docs[0].data();
          const lastNo = lastDoc.jobCardNo;
          const parts = lastNo.split('/');
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num)) {
            setValue('jobCardNo', `PI/JC/${num + 1}`);
          } else {
            setValue('jobCardNo', 'PI/JC/1001');
          }
        }
      } catch (err) {
        console.error(err);
        setValue('jobCardNo', 'PI/JC/1001');
      } finally {
        setLoadingNextNo(false);
      }
    };
    fetchNextNo();
  }, [setValue, isEditMode]);

  const selectedCustomerId = watch('customerId');
  const selectedProductId = watch('productId');
  const currentOrderQty = watch('orderQty');

  // Progressive Filtering: If Customer is selected, narrow products
  const uniqueCustomers = Array.from(new Set(products.map((p: any) => p.customerId)))
    .map(id => {
      const prod = products.find((p: any) => p.customerId === id);
      return { id, name: prod?.customerName };
    })
    .filter(c => c.name);

  const availableProducts = selectedCustomerId 
    ? products.filter((p: any) => p.customerId === selectedCustomerId)
    : products;

  const isProductChanged = isEditMode && selectedProductId !== initialData?.productId;
  const activeProductData = (!isEditMode || isProductChanged) 
    ? products.find((p: any) => p.id === selectedProductId) 
    : initialData?.productSnapshot;

  const orderQtyVal = Number(watch('orderQty')) || 0;

  const liveCalculations = useMemo(() => {
    if (!activeProductData) return null;
    const ups = activeProductData.ups > 0 ? activeProductData.ups : 1;
    const noOfPaper = Math.ceil(orderQtyVal / ups);
    let totalWeight = 0;
    
    const layers = (activeProductData.layers || []).map((layer: any) => {
      let gsm = Number(layer.gsm) || 0;
      let layerWeight = 0;
      if (gsm > 0 && activeProductData.reelSize > 0 && activeProductData.cutSize > 0) {
        let eff_gsm = gsm;
        if ((layer.layerName || '').toLowerCase().includes('flute')) {
          eff_gsm = gsm * 1.4;
        }
        layerWeight = (activeProductData.reelSize * activeProductData.cutSize * eff_gsm) / 3100 / 500 * noOfPaper;
        layerWeight = Math.round(layerWeight * 100) / 100;
        totalWeight += layerWeight;
      }
      return { ...layer, calculatedWeight: layerWeight };
    });
    
    totalWeight = Math.round(totalWeight * 100) / 100;
    const oneBoxWeight = orderQtyVal > 0 ? Math.round((totalWeight / orderQtyVal) * 100) / 100 : 0;
    
    return {
      noOfPaper,
      layers,
      totalWeight,
      oneBoxWeight
    };
  }, [activeProductData, orderQtyVal]);

  const onSubmit = async (data: any) => {
    if (!activeProductData) return;

    try {
      const orderQty = Number(data.orderQty);

      // Construct final payload
      const jobCardPayload = {
        jobCardNo: data.jobCardNo,
        targetDate: data.targetDate,
        
        customerId: activeProductData.customerId,
        customerName: activeProductData.customerName,
        productId: activeProductData.id || activeProductData.productId,
        productName: activeProductData.itemName,
        
        orderQty,
        oneBoxWeight: liveCalculations?.oneBoxWeight || 0,
        totalWeight: liveCalculations?.totalWeight || 0,
        paperQuantity: liveCalculations?.noOfPaper || 0,
        plyQuantity: liveCalculations?.noOfPaper || 0, // For corrugated boxes, paper quantity (cuts) equals ply production quantity
        
        priority: data.priority || 'Normal',
        remarks: data.remarks || '',
        
        // Update snapshot if product changed, else keep existing
        productSnapshot: {
          ...activeProductData,
          layers: liveCalculations?.layers || activeProductData.layers || []
        },
      };

      if (isEditMode) {
        await updateDocument('jobCards', initialData.id, jobCardPayload, user?.name);
      } else {
        await createDocument('jobCards', { ...jobCardPayload, status: 'PENDING' }, user?.name);
      }
      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Failed to save job card');
    }
  };

  const inputCls = "w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 overflow-auto">
      <div className="bg-card w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-full">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="text-xl font-bold text-foreground flex items-center">
            {isEditMode ? <Edit className="w-5 h-5 mr-2 text-blue-500" /> : <Plus className="w-5 h-5 mr-2 text-primary" />}
            {isEditMode ? 'Edit Job Card' : 'Create New Job Card'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="jc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <input type="hidden" {...register('jobCardNo')} />
            <input type="hidden" {...register('targetDate')} />
            
            {/* Row 1: Auto-generated Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/10 p-5 rounded-lg border border-border relative">
              {isEditMode && !isProductChanged && (
                 <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                   Using Locked Snapshot
                 </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Job Card No.</label>
                <div className="flex items-center">
                  <span className="text-lg font-bold text-primary">{watch('jobCardNo')}</span>
                  {!isEditMode && loadingNextNo && <CircleDashed className="w-4 h-4 ml-2 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Date</label>
                <div className="text-lg font-bold text-foreground">
                  {watch('targetDate') ? new Date(watch('targetDate')).toLocaleDateString() : '...'}
                </div>
              </div>
            </div>

            {/* Row 2: Manual Inputs (Product & Quantity) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 relative">
                <label className="text-sm font-semibold text-foreground">Select Product <span className="text-destructive">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search Product / Artwork..."
                    className={inputCls + " font-medium text-base h-11 w-full"}
                    disabled={loadingProducts}
                    value={productSearchText}
                    onChange={(e) => {
                      setProductSearchText(e.target.value);
                      setShowProductDropdown(true);
                      setValue('productId', ''); // Clear underlying form value
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  />
                  {/* Hidden input for react-hook-form */}
                  <input type="hidden" {...register('productId', { required: true })} />
                  
                  {showProductDropdown && (
                    <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-300 rounded-md shadow-xl max-h-64 overflow-y-auto">
                      {isEditMode && !products.find((p:any) => p.id === initialData.productId) && (
                        <div 
                          className="px-4 py-3 cursor-pointer hover:bg-gray-100 border-b border-gray-100"
                          onMouseDown={() => {
                            setValue('productId', initialData.productId);
                            setProductSearchText(`${initialData.productName} (Historical)`);
                            setShowProductDropdown(false);
                          }}
                        >
                          <div className="font-bold text-sm text-black">{initialData.productName}</div>
                          <div className="text-xs text-gray-500">Historical Record</div>
                        </div>
                      )}
                      
                      {products.filter((p: any) => {
                        const searchLower = productSearchText.toLowerCase();
                        return !productSearchText || 
                               (p.itemName && p.itemName.toLowerCase().includes(searchLower)) || 
                               (p.artworkNo && p.artworkNo.toLowerCase().includes(searchLower));
                      }).map((p: any) => (
                        <div 
                          key={p.id}
                          className="px-4 py-3 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-0"
                          onMouseDown={() => {
                            setValue('productId', p.id);
                            setProductSearchText(`${p.itemName} / ${p.artworkNo}`);
                            setShowProductDropdown(false);
                          }}
                        >
                          <div className="font-bold text-sm text-black">{p.itemName}</div>
                          <div className="text-xs text-gray-600">Artwork: {p.artworkNo}</div>
                        </div>
                      ))}
                      
                      {products.filter((p: any) => {
                        const searchLower = productSearchText.toLowerCase();
                        return !productSearchText || 
                               (p.itemName && p.itemName.toLowerCase().includes(searchLower)) || 
                               (p.artworkNo && p.artworkNo.toLowerCase().includes(searchLower));
                      }).length === 0 && (
                        <div className="px-4 py-4 text-sm text-gray-500 italic text-center">
                          No matching products found.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Quantity <span className="text-destructive">*</span></label>
                <input 
                  type="number"
                  {...register('orderQty', { required: true, min: 1 })} 
                  placeholder="e.g. 5000"
                  className={inputCls + " text-lg font-bold h-11"} 
                />
              </div>
            </div>

            {/* Smart Auto-fill Preview section */}
            {activeProductData && (
              <div className="bg-secondary/20 rounded-lg p-5 border border-border shadow-inner">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> 
                  Master Data Snapshot Ready
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-1">Customer</span>
                    <span className="font-semibold text-foreground">{activeProductData.customerName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-1">Dimensions (L x W x H)</span>
                    <span className="font-semibold text-foreground">{activeProductData.length}" x {activeProductData.width}" x {activeProductData.height}"</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-1">Ply & Flute</span>
                    <span className="font-semibold text-foreground">{activeProductData.ply} Ply, '{activeProductData.flute}' Flute</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-1">Reel x Cut Size</span>
                    <span className="font-semibold text-foreground">{activeProductData.reelSize}" x {activeProductData.cutSize}"</span>
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-border">
                  <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-3">Paper Layers Configuration (Live Calculation)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(liveCalculations?.layers || []).map((layer: any, idx: number) => (
                      <div key={idx} className="bg-background border border-border rounded-md p-3 flex justify-between items-center shadow-sm">
                        <span className="text-xs font-bold text-muted-foreground uppercase">{layer.layerName}</span>
                        <div className="text-right">
                          <span className="block text-sm text-foreground font-bold leading-none mb-1">{layer.paperType}</span>
                          <span className="text-[10px] text-muted-foreground font-medium block">{layer.bf} BF | {layer.gsm} GSM</span>
                          <span className="text-xs font-bold text-primary block mt-1">{layer.calculatedWeight || 0} Kg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 bg-primary/5 p-4 rounded-md border border-primary/10">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-1">Total Paper Weight</span>
                      <span className="font-bold text-lg text-foreground">{liveCalculations?.totalWeight || 0} Kg</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-1">Required Cut Sheets</span>
                      <span className="font-bold text-lg text-foreground">{liveCalculations?.noOfPaper || 0}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-5 pt-5 border-t border-border">
                  <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-3">Product Specifications</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-1">Color</span>
                      <span className="font-semibold text-foreground">{activeProductData.color || 'Plain'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-1">Joint</span>
                      <span className="font-semibold text-foreground">
                        {activeProductData.jointType === 'PIN' ? `PIN (${activeProductData.pinType || 'N/A'}, Qty: ${activeProductData.pinQty || '-'})` : (activeProductData.jointType === 'PASTING' ? 'PASTING' : 'N/A')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-1">Creasing</span>
                      <span className="font-semibold text-foreground">
                        {activeProductData.creasing === 'DIE' ? `DIE (No: ${activeProductData.dieNo || 'N/A'})` : (activeProductData.creasing || 'N/A')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold mb-1">UPS</span>
                      <span className="font-semibold text-foreground">{activeProductData.ups || 1}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-5 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400">
                    The weight calculation engine will execute on save based on this locked snapshot. Future edits to Master Data will not affect this Job Card.
                  </p>
                </div>
              </div>
            )}
            
          </form>
        </div>

        <div className="p-6 border-t border-border flex justify-between gap-3 bg-card shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-b-xl z-10">
          <div>
            {isEditMode && (
              <button type="button" className="px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors border border-transparent hover:border-destructive/20">
                Archive Job Card
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              form="jc-form"
              disabled={isSubmitting || !activeProductData}
              className={cn("px-8 py-2 text-sm font-medium rounded-md text-white transition-colors shadow-lg flex items-center disabled:opacity-50",
                isEditMode ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20" : "bg-primary hover:bg-primary/90 shadow-primary/20"
              )}
            >
              {isSubmitting && <CircleDashed className="w-4 h-4 mr-2 animate-spin" />}
              {isEditMode ? 'Update Job Card' : 'Generate Job Card'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
