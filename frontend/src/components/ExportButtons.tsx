import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../lib/exportUtils';
import { cn } from '../lib/utils';

interface ExportButtonsProps {
  data: any[];
  filenamePrefix: string;
  title: string;
  columnMap?: { [key: string]: string };
  className?: string;
}

export default function ExportButtons({ data, filenamePrefix, title, columnMap, className }: ExportButtonsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (type: 'excel' | 'pdf') => {
    setIsOpen(false);
    if (type === 'excel') {
      exportToExcel(data, filenamePrefix, columnMap);
    } else {
      exportToPDF(data, filenamePrefix, title, columnMap);
    }
  };

  return (
    <div className={cn("relative inline-block text-left z-20", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!data || data.length === 0}
        className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-md shadow-sm hover:bg-secondary transition-colors focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      >
        <Download className="w-4 h-4 mr-2 text-primary" />
        Export Data
        <ChevronDown className="w-4 h-4 ml-2 -mr-1 text-muted-foreground" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute right-0 w-48 mt-2 origin-top-right bg-card border border-border divide-y divide-border rounded-md shadow-lg outline-none">
          <div className="py-1">
            <button
              onClick={() => handleExport('excel')}
              className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 mr-3 text-green-600" />
              Export to Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <FileText className="w-4 h-4 mr-3 text-red-500" />
              Export to PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
