import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
let grandTotal = 0;

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  let sheetTotal = 0;
  let sheetReels = 0;
  
  for (let r = 1; r <= 1000; r++) {
    const nameB = sheet['B' + r] ? String(sheet['B' + r].v).trim().toUpperCase() : '';
    if (!nameB || nameB === 'UNDEFINED' || nameB === 'REEL NO.') continue;

    const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
    const balance = Number(balRaw) || 0;
    if (balance <= 0) continue;

    // How to determine if it's VK?
    const paperTypeA = sheet['A' + r] ? String(sheet['A' + r].v).trim().toUpperCase() : '';
    const paperTypeG = sheet['G' + r] ? String(sheet['G' + r].v).trim().toUpperCase() : '';
    const paperTypeH = sheet['H' + r] ? String(sheet['H' + r].v).trim().toUpperCase() : '';

    let isVK = false;
    if (sheetName === 'Virgin  Stock') isVK = true;
    if (paperTypeA === 'VK' || paperTypeG === 'VK' || paperTypeH === 'VK') isVK = true;
    if (nameB.includes('VK')) isVK = true;

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
