import xlsx from 'xlsx';
const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
console.log(workbook.SheetNames);
