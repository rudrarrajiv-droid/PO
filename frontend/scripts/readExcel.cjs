const xlsx = require('xlsx');

const workbook = xlsx.readFile('d:\\po\\Storage_file\\Job Card July 2026(1).xlsx');
console.log("Sheets available:", workbook.SheetNames);

const masterSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('master'));
if (masterSheetName) {
    const sheet = workbook.Sheets[masterSheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\nHeaders in ${masterSheetName}:`);
    console.log(data[0]);
    console.log(`Sample Row 1:`, data[1]);
} else {
    console.log("\nCould not find a sheet with 'master' in its name.");
}
