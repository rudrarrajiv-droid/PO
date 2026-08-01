import xlsx from 'xlsx';

const filePath = 'D:/po/JOB CARD/Job Card July 2026.xlsx';
const workbook = xlsx.readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);

const inventorySheet = workbook.Sheets['6. Reel Inventory'];
if (inventorySheet) {
  const data = xlsx.utils.sheet_to_json(inventorySheet, { header: 1 });
  console.log('Reel Inventory Headers:', data[0]);
  console.log('Reel Inventory Row 1:', data[1]);
}
