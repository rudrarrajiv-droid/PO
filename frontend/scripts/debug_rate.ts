import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

function checkCsv() {
  const csvContent = fs.readFileSync('d:/po/Storage_file/reel_data.csv', 'utf-8');
  const cleanContent = csvContent.replace(/^\uFEFF/, '');
  const records = parse(cleanContent, { columns: true, skip_empty_lines: true, trim: true });

  for (let i = 0; i < 5; i++) {
    const row = records[i];
    console.log(`Row ${i+2} Reel ${row['Reel No']} Rate: "${row['Rate']}", parsed: ${Number(row['Rate'])}`);
  }
}
checkCsv();
