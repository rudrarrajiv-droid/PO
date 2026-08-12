import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

function checkCsv() {
  const csvContent = fs.readFileSync('d:/po/Storage_file/reel_data.csv', 'utf-8');
  const cleanContent = csvContent.replace(/^\uFEFF/, '');
  const records = parse(cleanContent, { columns: true, skip_empty_lines: true, trim: true });

  const typesAndBfs = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const pt = row['Paper Type']?.toUpperCase();
    const bf = row['BF'];
    typesAndBfs.add(`${pt} - ${bf}`);
  }

  console.log("Unique Paper Type - BF combinations:");
  for (const combo of Array.from(typesAndBfs).sort()) {
    console.log(combo);
  }
}
checkCsv();
