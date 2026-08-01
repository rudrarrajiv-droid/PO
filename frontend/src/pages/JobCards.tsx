import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getJobCards, getProducts, createJobCard, getNextJobCardNo } from '../lib/api';
import { Plus, Search, CheckCircle2, CircleDashed, FileText, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { cn } from '../lib/utils';

export default function JobCards() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: jobCards = [], isLoading: loadingCards, refetch: refetchCards } = useQuery({
    queryKey: ['jobcards'],
    queryFn: getJobCards,
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Job Cards</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and track production job cards</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-primary text-primary-foreground px-4 py-2 flex items-center text-sm font-medium rounded-md shadow hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Job Card
        </button>
      </div>

      <div className="flex-1 bg-card border border-border shadow-sm rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search job cards..." 
              className="pl-9 pr-4 py-2 w-full text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
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
                  <th className="px-6 py-3 font-medium">Qty</th>
                  <th className="px-6 py-3 font-medium">Weight (Total)</th>
                  <th className="px-6 py-3 font-medium">Target Date</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobCards.map((jc: any) => (
                  <tr key={jc.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{jc.jobCardNo}</td>
                    <td className="px-6 py-4">{jc.product?.customer?.name}</td>
                    <td className="px-6 py-4">{jc.product?.itemName}</td>
                    <td className="px-6 py-4 font-semibold">{jc.orderQty}</td>
                    <td className="px-6 py-4">{jc.totalWeight} Kg</td>
                    <td className="px-6 py-4">{new Date(jc.targetDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-full", 
                        jc.status === 'Completed' ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" :
                        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                      )}>
                        {jc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a 
                        href={`http://localhost:5000/api/jobcards/${jc.id}/pdf`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Print PDF
                      </a>
                    </td>
                  </tr>
                ))}
                {jobCards.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto text-muted mb-3" />
                      <p>No job cards found. Create a new one to get started.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isFormOpen && (
        <JobCardModal 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => {
            setIsFormOpen(false);
            refetchCards();
          }} 
        />
      )}
    </div>
  );
}

function JobCardModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm();
  
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  useEffect(() => {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setValue('targetDate', today);
    
    // Fetch next job card number
    getNextJobCardNo().then(nextNo => {
      setValue('jobCardNo', nextNo);
    }).catch(err => console.error(err));
  }, [setValue]);

  const selectedProductId = watch('productId');
  const selectedProduct = products.find((p: any) => p.id === Number(selectedProductId));

  const onSubmit = async (data: any) => {
    try {
      await createJobCard({
        jobCardNo: data.jobCardNo,
        targetDate: data.targetDate,
        productId: Number(data.productId),
        orderQty: Number(data.orderQty),
        priority: data.priority,
        remarks: data.remarks
      });
      onSuccess();
    } catch (error) {
      alert('Failed to create job card');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 overflow-auto">
      <div className="bg-card w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-full">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center">
            <Plus className="w-5 h-5 mr-2 text-primary" />
            Create New Job Card
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="jc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Row 1: Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Job Card No.</label>
                <input 
                  {...register('jobCardNo', { required: true })} 
                  placeholder="e.g. JC-1025"
                  className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Target Date</label>
                <input 
                  type="date"
                  {...register('targetDate', { required: true })} 
                  className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Priority</label>
                <select 
                  {...register('priority')} 
                  className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Row 2: Product Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Select Product (Master Data)</label>
                <select 
                  {...register('productId', { required: true })} 
                  className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={loadingProducts}
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.itemName} (Art: {p.artworkNo}) - {p.customer.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Order Quantity (Boxes)</label>
                <input 
                  type="number"
                  {...register('orderQty', { required: true, min: 1 })} 
                  placeholder="0"
                  className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
            </div>

            {/* Smart Auto-fill Preview section */}
            {selectedProduct && (
              <div className="bg-secondary/30 rounded-lg p-5 border border-border">
                <h3 className="text-sm font-bold text-foreground mb-4 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> 
                  Smart Auto-Fill Specifications
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Customer</span>
                    <span className="font-semibold text-foreground">{selectedProduct.customer.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Dimensions (L x W x H)</span>
                    <span className="font-semibold text-foreground">{selectedProduct.length}" x {selectedProduct.width}" x {selectedProduct.height}"</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Ply & Flute</span>
                    <span className="font-semibold text-foreground">{selectedProduct.ply} Ply, '{selectedProduct.flute}' Flute</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Reel x Cut Size</span>
                    <span className="font-semibold text-foreground">{selectedProduct.reelSize}" x {selectedProduct.cutSize}"</span>
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-border">
                  <span className="text-muted-foreground block text-xs mb-2">Paper Layers Configuration</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedProduct.layers.map((layer: any, idx: number) => (
                      <div key={idx} className="bg-background border border-border rounded p-3 text-xs flex justify-between items-center">
                        <span className="font-medium">{layer.layerName}</span>
                        <div className="text-right">
                          <span className="block text-foreground font-semibold">{layer.paperType}</span>
                          <span className="text-muted-foreground">{layer.bf} BF | {layer.gsm} GSM</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-5 p-4 bg-primary/10 border border-primary/20 rounded-md">
                  <p className="text-sm font-medium text-primary">
                    Weight Calculation Engine will run upon saving based on Master Data specs and GAS exact formulas.
                  </p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Remarks / Special Instructions</label>
              <textarea 
                {...register('remarks')} 
                rows={2}
                className="w-full text-sm rounded-md border border-input px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" 
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3 bg-secondary/30">
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
            disabled={isSubmitting}
            className="px-6 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow flex items-center"
          >
            {isSubmitting && <CircleDashed className="w-4 h-4 mr-2 animate-spin" />}
            Generate Job Card
          </button>
        </div>
      </div>
    </div>
  );
}
