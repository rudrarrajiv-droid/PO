import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
const sheet = workbook.Sheets['Virgin  Stock'];

for (let r = 1; r <= 200; r++) {
  const row = [];
  for (let c = 65; c <= 75; c++) { // A-K
    const col = String.fromCharCode(c);
    const val = sheet[col + r] ? sheet[col + r].v : '';
    row.push(val);
  }
  if (row.some(v => v !== '')) {
    console.log(`Row ${r}: ${JSON.stringify(row)}`);
  }
}
