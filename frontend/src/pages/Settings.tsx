import React, { useState } from 'react';
import { Settings as SettingsIcon, Download, Database, PackageSearch, AlertCircle } from 'lucide-react';
import { queryDocuments, createDocument } from '../lib/firebase/services';
import seedData from '../data/seedData.json';

export default function Settings() {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const handleImportLegacyData = async () => {
    if (!confirm('Are you sure you want to import legacy master data? This will add hundreds of records.')) return;
    
    setIsImporting(true);
    setImportProgress(0);
    try {
      const customers = Array.from(new Set(seedData.map((d: any) => d.customerName)));
      
      // 1. Create customers
      const customerMap = new Map();
      for (const cName of customers) {
        const id = cName.toLowerCase().replace(/\s+/g, '-');
        await createDocument('customers', { name: cName }, 'System');
        customerMap.set(cName, id);
      }

      // 2. Create products
      for (let i = 0; i < seedData.length; i++) {
        const doc = seedData[i];
        await createDocument('products', {
          ...doc,
          customerId: customerMap.get(doc.customerName) || doc.customerId
        }, 'System');
        setImportProgress(Math.round(((i + 1) / seedData.length) * 100));
      }

      alert('Legacy Data Import Complete!');
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async (collectionName: string, filenamePrefix: string) => {
    try {
      setIsExporting(collectionName);
      const data = await queryDocuments(collectionName, []);
      
      if (!data || data.length === 0) {
        alert(`No data found in ${collectionName}.`);
        return;
      }

      // Convert to CSV
      const keys = Array.from(new Set(data.flatMap(Object.keys)));
      const csvRows = [
        keys.join(','), // Header row
        ...data.map(row => keys.map(k => {
          let val = (row as any)[k];
          if (typeof val === 'object' && val !== null) {
            // Check if it's a Firestore Timestamp
            if (val.toDate && typeof val.toDate === 'function') {
              val = val.toDate().toISOString();
            } else {
              val = JSON.stringify(val);
            }
          }
          if (val === undefined || val === null) val = '';
          // Escape quotes
          const strVal = String(val).replace(/"/g, '""');
          return `"${strVal}"`;
        }).join(','))
      ];
      
      const csvContent = csvRows.join('\n');
      
      // Create Blob and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `${filenamePrefix}-${dateStr}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full gap-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Application configuration and data management.</p>
      </div>

      <div className="grid gap-6">
        
        {/* Data Management Section */}
        <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border bg-secondary/30">
            <h2 className="text-lg font-bold flex items-center">
              <Database className="w-5 h-5 mr-2 text-primary" />
              Data Backup & Export
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Download complete CSV backups of your critical business data.</p>
          </div>
          
          <div className="p-6 grid md:grid-cols-2 gap-6">
            
            {/* Master Data Backup */}
            <div className="border border-border rounded-lg p-5 flex flex-col justify-between items-start gap-4 hover:border-primary/50 transition-colors">
              <div>
                <h3 className="font-bold flex items-center">
                  <Database className="w-4 h-4 mr-2" />
                  Master Data
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Includes all customer specifications, dimensions, and product logic.</p>
              </div>
              <button 
                onClick={() => handleExport('products', 'master-data-backup')}
                disabled={isExporting !== null}
                className="w-full flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isExporting === 'products' ? (
                  <span className="animate-pulse">Exporting...</span>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV Backup
                  </>
                )}
              </button>
            </div>

            {/* Reel Inventory Backup */}
            <div className="border border-border rounded-lg p-5 flex flex-col justify-between items-start gap-4 hover:border-primary/50 transition-colors">
              <div>
                <h3 className="font-bold flex items-center">
                  <PackageSearch className="w-4 h-4 mr-2" />
                  Reel Inventory
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Includes current stock balances, specs, and historical transactions.</p>
              </div>
              <button 
                onClick={() => handleExport('reels', 'reel-inventory-backup')}
                disabled={isExporting !== null}
                className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isExporting === 'reels' ? (
                  <span className="animate-pulse">Exporting...</span>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV Backup
                  </>
                )}
              </button>
            </div>

          </div>
          <div className="p-4 bg-yellow-50 text-yellow-800 text-xs border-t border-yellow-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p><strong>Note:</strong> These backups are raw CSV extracts suitable for offline viewing in Excel. Do not manually edit and re-upload these files unless instructed.</p>
          </div>
        </section>

        {/* Developer / Admin Section */}
        <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden mt-6">
          <div className="p-5 border-b border-border bg-secondary/30">
            <h2 className="text-lg font-bold flex items-center text-orange-600">
              <Database className="w-5 h-5 mr-2" />
              Legacy Data Import (Admin Only)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Import master data directly from the legacy Excel dump.</p>
          </div>
          
          <div className="p-6">
            <button 
              onClick={handleImportLegacyData}
              disabled={isImporting}
              className="px-6 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {isImporting ? `Importing... ${importProgress}%` : 'Import Legacy Master Data'}
            </button>
            {isImporting && (
              <div className="mt-4 w-full bg-secondary rounded-full h-2">
                <div className="bg-orange-600 h-2 rounded-full" style={{ width: `${importProgress}%` }}></div>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
