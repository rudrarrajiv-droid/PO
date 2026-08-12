import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

function checkCsv() {
  const csvContent = fs.readFileSync('d:/po/Storage_file/salary_data.csv', 'utf-8');
  const cleanContent = csvContent.replace(/^\uFEFF/, '');
  const records = parse(cleanContent, { columns: true, skip_empty_lines: true, trim: true });

  if (records.length > 0) {
    console.log("Headers:", Object.keys(records[0]));
    console.log("First Row:", records[0]);
  } else {
    console.log("CSV is empty.");
  }
}
checkCsv();
