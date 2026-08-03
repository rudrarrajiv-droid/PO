import xlsx from 'xlsx';
const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
const sheet = workbook.Sheets['Virgin'];
let total = 0;
let count = 0;
for (let r = 4; r <= 300; r++) {
  const name = sheet['B' + r] ? String(sheet['B' + r].v).trim() : '';
  if (name && name !== 'undefined') {
     const bal = Number(sheet['I' + r] ? sheet['I' + r].v : 0) || 0;
     if (bal > 0) {
        total += bal;
        count++;
     }
  }
}
console.log(`Virgin Sheet Total Weight: ${total} from ${count} reels`);
