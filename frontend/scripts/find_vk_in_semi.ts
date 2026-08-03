import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
const sheet = workbook.Sheets['Semi Stock'];
let total = 0;
let count = 0;

for (let r = 5; r <= 300; r++) {
  const type = sheet['G' + r] ? String(sheet['G' + r].v).trim().toUpperCase() : '';
  const name = sheet['B' + r] ? String(sheet['B' + r].v).trim().toUpperCase() : '';
  const nameA = sheet['A' + r] ? String(sheet['A' + r].v).trim().toUpperCase() : '';
  
  if (type === 'VK' || name.includes('VK') || nameA.includes('VK')) {
     const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
     const balance = Number(balRaw) || 0;
     if (balance > 0) {
        total += balance;
        count++;
        console.log(`Found VK reel in Semi Stock row ${r}: ${name}, Balance: ${balance}`);
     }
  }
}
console.log(`Semi Stock VK Total Weight: ${total} from ${count} reels`);
