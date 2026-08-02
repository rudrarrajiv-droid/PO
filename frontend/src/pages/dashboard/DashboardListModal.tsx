import React from 'react';
import { X, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import ExportButtons from '../../components/ExportButtons';

export default function DashboardListModal({ title, jobCards, onClose }: { title: string, jobCards: any[], onClose: () => void }) {
  const navigate = useNavigate();

  const handleOpenJobCard = (jc: any) => {
    // Navigate to job cards page and maybe pass a query param or state if we wanted to auto-open it.
    // For now, navigating to the Job Cards page with the customer/product pre-filled in mind, or just navigating to the list is fine.
    // To make it super useful, we'll just navigate to the Job Cards page.
    navigate('/job-cards');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-card w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] border border-border">
        
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0 bg-secondary/30">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center">
              {title} Job Cards
            </h2>
            <p className="text-sm text-muted-foreground">{jobCards.length} records found.</p>
          </div>
          <div className="flex gap-3 items-center">
            <ExportButtons 
              data={jobCards}
              filenamePrefix={`Dashboard_${title}`}
              title={`${title} Job Cards`}
              columnMap={{
                'jobCardNo': 'Job Card #',
                'customerName': 'Customer',
                'productName': 'Product',
                'orderQty': 'Qty',
                'status': 'Status',
                'date': 'Job Card Date',
                'issuedAt': 'Issue Date',
                'completedAt': 'Completed Date'
              }}
            />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors bg-secondary/50 p-1.5 rounded-md border border-border">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-0 overflow-y-auto flex-1">
          {jobCards.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No Job Cards found for this status.
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-medium border-b border-border">Job Card #</th>
                  <th className="p-4 font-medium border-b border-border">Customer</th>
                  <th className="p-4 font-medium border-b border-border">Product</th>
                  <th className="p-4 font-medium text-right border-b border-border">Order Qty</th>
                  <th className="p-4 font-medium text-right border-b border-border">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobCards.map(jc => (
                  <tr key={jc.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-bold">{jc.jobCardNo}</td>
                    <td className="p-4">{jc.customerName}</td>
                    <td className="p-4">{jc.productName}</td>
                    <td className="p-4 text-right font-medium">{jc.orderQty}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleOpenJobCard(jc)}
                        className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
