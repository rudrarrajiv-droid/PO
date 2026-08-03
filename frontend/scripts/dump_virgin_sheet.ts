import xlsx from 'xlsx';
const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
const sheet = workbook.Sheets['Virgin'];
if (!sheet) {
  console.log('No Virgin sheet found');
  process.exit(0);
}
for (let r = 1; r <= 10; r++) {
  const row = [];
  for (let c = 65; c <= 75; c++) {
    const col = String.fromCharCode(c);
    row.push(sheet[col + r] ? sheet[col + r].v : '');
  }
  console.log(`Row ${r}: ${JSON.stringify(row)}`);
}
