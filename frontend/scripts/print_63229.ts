import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');

for (const sheetName of ['Virgin  Stock', 'Virgin']) {
  const sheet = workbook.Sheets[sheetName];
  let sheetTotal = 0;
  
  for (let r = 1; r <= 300; r++) {
    const name = sheet['B' + r] ? String(sheet['B' + r].v).trim().toUpperCase() : '';
    if (!name || name === 'UNDEFINED' || name === 'REEL NO.' || name === 'NO.') continue;
    
    const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
    const balance = Number(balRaw) || 0;
    if (balance > 0) {
      sheetTotal += balance;
      console.log(`[${sheetName}] Row ${r} - Reel: ${name} - Bal: ${balance}`);
    }
  }
  console.log(`TOTAL ${sheetName}: ${sheetTotal}`);
}
