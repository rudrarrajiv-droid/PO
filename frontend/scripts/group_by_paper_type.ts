import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
const groupStats = {};

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  
  for (let r = 1; r <= 500; r++) {
    const name = sheet['B' + r] ? String(sheet['B' + r].v).trim() : '';
    if (!name || name.toLowerCase().includes('undefined') || name.toLowerCase() === 'no.' || name.toLowerCase() === 'reel no.') continue;
    
    // check balance in I column
    const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
    const balance = Number(balRaw) || 0;
    if (balance <= 0) continue;

    // try to get paper type from Column A, B, G or sheet name
    let paperType = sheet['G' + r] ? String(sheet['G' + r].v).trim().toUpperCase() : '';
    if (!paperType) {
      if (sheetName.toUpperCase().includes('VIRGIN')) paperType = 'VK';
      else if (sheetName.toUpperCase().includes('DUP')) paperType = 'DUPLEX';
      else if (sheetName.toUpperCase().includes('SEMI')) paperType = 'SK';
      else paperType = 'UNKNOWN';
    }

    if (!groupStats[paperType]) {
      groupStats[paperType] = { weight: 0, count: 0, sheets: new Set() };
    }
    groupStats[paperType].weight += balance;
    groupStats[paperType].count += 1;
    groupStats[paperType].sheets.add(sheetName);
  }
}

for (const [pt, stats] of Object.entries(groupStats)) {
  console.log(`Type: ${pt.padEnd(10)} | Weight: ${String(stats.weight).padEnd(8)} | Reels: ${stats.count} | Sheets: ${Array.from(stats.sheets).join(', ')}`);
}
