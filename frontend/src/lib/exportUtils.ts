import * as xlsx from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Prepares data by flattening objects or formatting dates
 */
const prepareData = (data: any[], columnMap?: { [key: string]: string }) => {
  return data.map((row) => {
    const newRow: any = {};
    
    const processValue = (val: any): string => {
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') {
        if (val.toDate && typeof val.toDate === 'function') {
          return val.toDate().toLocaleString(); // Firestore timestamp
        }
        if (Array.isArray(val)) {
          return val.map(processValue).join(' | ');
        }
        return JSON.stringify(val);
      }
      return String(val);
    };

    if (columnMap) {
      for (const [key, header] of Object.entries(columnMap)) {
        // Handle nested keys like "layers.0.paperType" or just simple keys
        const val = key.split('.').reduce((acc, part) => acc && acc[part], row);
        newRow[header] = processValue(val);
      }
    } else {
      for (const [key, val] of Object.entries(row)) {
        newRow[key] = processValue(val);
      }
    }
    
    return newRow;
  });
};

/**
 * Export to Excel (.xlsx)
 */
export const exportToExcel = (data: any[], filenamePrefix: string, columnMap?: { [key: string]: string }) => {
  if (!data || data.length === 0) {
    alert('No data to export.');
    return;
  }

  const processedData = prepareData(data, columnMap);
  const worksheet = xlsx.utils.json_to_sheet(processedData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  const dateStr = new Date().toISOString().split('T')[0];
  xlsx.writeFile(workbook, `${filenamePrefix}-${dateStr}.xlsx`);
};

/**
 * Export to PDF using jsPDF and jspdf-autotable
 */
export const exportToPDF = (data: any[], filenamePrefix: string, title: string, columnMap?: { [key: string]: string }) => {
  if (!data || data.length === 0) {
    alert('No data to export.');
    return;
  }

  const processedData = prepareData(data, columnMap);
  
  // Extract headers and rows
  const headers = Object.keys(processedData[0]);
  const rows = processedData.map(row => headers.map(h => row[h]));

  const doc = new jsPDF({ orientation: 'landscape' });
  
  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  // Add timestamp
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

  // AutoTable
  autoTable(doc, {
    startY: 36,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    margin: { top: 36, right: 14, bottom: 20, left: 14 },
    didDrawPage: (data: any) => {
      // Footer with page number
      const str = `Page ${(doc as any).internal.getNumberOfPages()}`;
      doc.setFontSize(8);
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
      doc.text(str, data.settings.margin.left, pageHeight - 10);
    }
  });

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`${filenamePrefix}-${dateStr}.pdf`);
};

/**
 * A generic Export Button component to be reused across pages
 */
export const ExportDropdown = ({ 
  data, 
  filenamePrefix, 
  title, 
  columnMap 
}: { 
  data: any[], 
  filenamePrefix: string, 
  title: string, 
  columnMap?: { [key: string]: string } 
}) => {
  return null; // Will define actual component in a separate UI file if needed, or inline.
}
