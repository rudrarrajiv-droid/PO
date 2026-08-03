import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
let grandTotal = 0;

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  let sheetTotal = 0;
  let sheetReels = 0;
  
  for (let r = 1; r <= 1000; r++) {
    const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
    const balance = Number(balRaw) || 0;
    if (balance <= 0) continue;

    let isVK = false;
    if (sheetName === 'Virgin  Stock') isVK = true;
    
    // check all columns A-Z
    for (let c = 65; c <= 90; c++) {
      const col = String.fromCharCode(c);
      const val = sheet[col + r] ? String(sheet[col + r].v).trim().toUpperCase() : '';
      if (val === 'VK' || val.includes('VK')) {
         isVK = true;
         break;
      }
    }

    if (isVK) {
      sheetTotal += balance;
      sheetReels++;
    }
  }
  if (sheetReels > 0) {
    console.log(`Sheet: ${sheetName} -> VK Weight: ${sheetTotal} (Reels: ${sheetReels})`);
    grandTotal += sheetTotal;
  }
}
console.log(`GRAND TOTAL VK WEIGHT: ${grandTotal}`);
