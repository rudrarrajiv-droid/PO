import * as XLSX from 'xlsx';
import { type PurchaseOrder } from '../lib/firebase/services';

/**
 * Export Purchase Orders to an Excel file
 * @param poList The filtered list of POs to export
 */
export const exportPurchaseOrdersToExcel = (poList: PurchaseOrder[]) => {
  // Format the data for Excel
  const excelData = poList.map((po, index) => ({
    'S.No': index + 1,
    'PO No.': po.poNo,
    'PO Date': po.poDate,
    'Delivery Date': po.deliveryDate,
    'Customer Name': po.customerName,
    'Consignee': po.consignee || '',
    'Item Name': po.productName,
    'Artwork No': po.artworkNo || '',
    'Size': po.size,
    'Rate (₹)': po.rate,
    'OPN QTY': po.orderQty,
    'IN QTY': po.inQty || 0,
    'OUT QTY': po.outQty || 0,
    'Closing Bal': po.orderQty + (po.inQty || 0) - (po.outQty || 0),
    'Value (₹)': (po.orderQty + (po.inQty || 0) - (po.outQty || 0)) * po.rate,
    'Status': po.status,
  }));

  // Create worksheet and workbook
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();

  // Add some styling/column widths
  const colWidths = [
    { wch: 6 },   // S.No
    { wch: 15 },  // PO No.
    { wch: 12 },  // PO Date
    { wch: 12 },  // Delivery Date
    { wch: 25 },  // Customer Name
    { wch: 20 },  // Consignee
    { wch: 30 },  // Item Name
    { wch: 15 },  // Artwork No
    { wch: 20 },  // Size
    { wch: 10 },  // Rate
    { wch: 10 },  // OPN QTY
    { wch: 10 },  // IN QTY
    { wch: 10 },  // OUT QTY
    { wch: 12 },  // Closing Bal
    { wch: 15 },  // Value
    { wch: 12 },  // Status
  ];
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Orders');

  // Generate filename with current date
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Purchase_Orders_Export_${dateStr}.xlsx`;

  // Trigger download
  XLSX.writeFile(workbook, filename);
};
