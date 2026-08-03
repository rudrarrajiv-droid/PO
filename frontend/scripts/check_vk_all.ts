import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
let grandTotal = 0;

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  let sheetTotal = 0;
  
  for (let r = 1; r <= 1000; r++) {
    const name = sheet['B' + r] ? String(sheet['B' + r].v).trim().toUpperCase() : '';
    if (!name || name === 'UNDEFINED' || name === 'REEL NO.' || name === 'NO.') continue;
    
    const typeG = sheet['G' + r] ? String(sheet['G' + r].v).trim().toUpperCase() : '';
    const typeH = sheet['H' + r] ? String(sheet['H' + r].v).trim().toUpperCase() : '';
    const typeA = sheet['A' + r] ? String(sheet['A' + r].v).trim().toUpperCase() : '';
    
    let isVK = false;
    if (typeG === 'VK' || typeH === 'VK' || typeA === 'VK') isVK = true;
    if (sheetName.toUpperCase() === 'VIRGIN  STOCK' || sheetName.toUpperCase() === 'VIRGIN') isVK = true;

    if (isVK) {
      const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
      const balance = Number(balRaw) || 0;
      if (balance > 0) {
        sheetTotal += balance;
      }
    }
  }
  if (sheetTotal > 0) {
    console.log(`Sheet: ${sheetName} -> VK Weight: ${sheetTotal}`);
    grandTotal += sheetTotal;
  }
}
console.log(`GRAND TOTAL VK WEIGHT: ${grandTotal}`);
