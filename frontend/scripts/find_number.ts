import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  for (let r = 1; r <= 1000; r++) {
    for (let c = 65; c <= 90; c++) {
      const col = String.fromCharCode(c);
      const cell = sheet[col + r];
      if (cell) {
        const v = cell.v;
        if (v === 63229 || v === '63229' || v === 12938 || v === '12938') {
          console.log(`Found ${v} at ${sheetName}!${col}${r}`);
        }
      }
    }
  }
}
