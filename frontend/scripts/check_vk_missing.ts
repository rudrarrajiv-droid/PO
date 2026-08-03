import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
const sheet = workbook.Sheets['Virgin  Stock'];

let totalWeight = 0;
let totalWeightRows5_149 = 0;
let maxRow = 1000; // Let's check up to 1000
let nonZeroCount = 0;
let nonZeroCount5_149 = 0;

for (let r = 1; r <= maxRow; r++) {
  const reelNumber = sheet['B' + r] ? String(sheet['B' + r].v).trim() : '';
  const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
  
  if (reelNumber && reelNumber !== 'undefined' && reelNumber !== 'Reel No.') {
    const balance = Number(balRaw) || 0;
    if (balance > 0) {
      totalWeight += balance;
      nonZeroCount++;
      if (r >= 5 && r <= 149) {
        totalWeightRows5_149 += balance;
        nonZeroCount5_149++;
      } else {
        console.log(`Found non-zero VK reel outside 5-149: Row ${r}, Reel: ${reelNumber}, Balance: ${balance}`);
      }
    }
  }
}

console.log(`Total Weight all rows: ${totalWeight} (Reels: ${nonZeroCount})`);
console.log(`Total Weight 5-149: ${totalWeightRows5_149} (Reels: ${nonZeroCount5_149})`);
