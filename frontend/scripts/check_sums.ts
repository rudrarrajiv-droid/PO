import xlsx from 'xlsx';

const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
const sheet = workbook.Sheets['Virgin  Stock'];

let sumF = 0; // Opening
let sumG = 0; // IN
let sumH = 0; // OUT
let sumI = 0; // Balance

for (let r = 5; r <= 200; r++) {
  const name = sheet['B' + r] ? String(sheet['B' + r].v).trim() : '';
  if (!name || name === 'undefined' || name === 'Reel No.') continue;
  
  const fRaw = sheet['F' + r] ? sheet['F' + r].v : '';
  const gRaw = sheet['G' + r] ? sheet['G' + r].v : '';
  const hRaw = sheet['H' + r] ? sheet['H' + r].v : '';
  const iRaw = sheet['I' + r] ? sheet['I' + r].v : '';

  const f = Number(fRaw) || 0;
  const g = Number(gRaw) || 0;
  const h = Number(hRaw) || 0;
  const i = Number(iRaw) || 0;

  sumF += f;
  sumG += g;
  sumH += h;
  sumI += i;
}

console.log(`Sum F (Opening): ${sumF}`);
console.log(`Sum G (In): ${sumG}`);
console.log(`Sum H (Out): ${sumH}`);
console.log(`Sum I (Balance): ${sumI}`);
