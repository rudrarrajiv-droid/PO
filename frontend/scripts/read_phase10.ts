import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
const sheetName = 'Dup';
const sheet = workbook.Sheets[sheetName];

if (!sheet) {
  console.log(`Sheet '${sheetName}' not found!`);
  process.exit(1);
}

let totalDupWeight = 0;
let totalDupValue = 0;
let validCount = 0;
let missingReelCount = 0;
let zeroBalanceCount = 0;
let missingRateCount = 0;

console.log(`--- PREVIEW OF DUP SHEET (Rows 4-13) ---`);

for (let r = 4; r <= 13; r++) {
  const reelNumber = sheet['B' + r] ? String(sheet['B' + r].v).trim() : '';
  const size = sheet['C' + r] ? String(sheet['C' + r].v).trim() : '';
  const bf = sheet['D' + r] ? String(sheet['D' + r].v).trim() : '';
  const gsm = sheet['E' + r] ? String(sheet['E' + r].v).trim() : '';
  const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
  const rateRaw = sheet['J' + r] ? sheet['J' + r].v : '';
  
  const balance = Number(balRaw) || 0;
  const rate = Number(rateRaw) || 0;
  
  if (balance <= 0) {
    zeroBalanceCount++;
    continue;
  }
  
  if (!reelNumber || reelNumber.toUpperCase() === 'UNDEFINED') {
    missingReelCount++;
    console.log(`Row ${r}: BLANK REEL NUMBER! Balance: ${balance}, Size: ${size}, BF: ${bf}, GSM: ${gsm}`);
    continue;
  }
  
  if (rate <= 0) {
    missingRateCount++;
  }
  
  totalDupWeight += balance;
  totalDupValue += balance * rate;
  validCount++;
  
  console.log(`Row ${r} -> Reel: ${reelNumber}, Size: ${size}, BF: ${bf}, GSM: ${gsm}, Bal: ${balance}, Rate: ${rate}, Value: ${balance * rate}`);
}

console.log(`\n--- SUMMARY ---`);
console.log(`Valid Records: ${validCount}`);
console.log(`Total DUP Weight: ${totalDupWeight} kg`);
console.log(`Total DUP Value: Rs. ${totalDupValue.toFixed(2)}`);
console.log(`Zero Balance Records (Ignored): ${zeroBalanceCount}`);
console.log(`Missing/Blank Reel Numbers (Skipped for now): ${missingReelCount}`);
console.log(`Records with Missing/Zero Rate: ${missingRateCount}`);
