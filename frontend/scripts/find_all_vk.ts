import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
let totalWeight = 0;

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  let sheetWeight = 0;
  let foundInSheet = 0;
  for (let r = 1; r <= 1000; r++) {
    // check if it's a VK reel. Sometimes paper type is in column G, or something?
    const ptRaw = sheet['G' + r] ? String(sheet['G' + r].v).trim().toUpperCase() : '';
    const nameRaw = sheet['B' + r] ? String(sheet['B' + r].v).trim().toUpperCase() : '';
    const nameA = sheet['A' + r] ? String(sheet['A' + r].v).trim().toUpperCase() : '';
    
    // How to identify a VK reel?
    // In 'Virgin  Stock', we assumed all are VK.
    let isVK = false;
    if (sheetName === 'Virgin  Stock') isVK = true;
    if (ptRaw === 'VK') isVK = true;
    if (nameRaw.includes('VK')) isVK = true;
    if (nameA.includes('VK')) isVK = true;

    if (isVK) {
      const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
      const balance = Number(balRaw) || 0;
      if (balance > 0) {
         sheetWeight += balance;
         foundInSheet++;
      }
    }
  }
  if (foundInSheet > 0) {
     console.log(`Sheet: ${sheetName} -> VK Weight: ${sheetWeight} (Reels: ${foundInSheet})`);
     totalWeight += sheetWeight;
  }
}
console.log(`GRAND TOTAL VK WEIGHT: ${totalWeight}`);
