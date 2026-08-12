import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

function checkCsv() {
  const csvContent = fs.readFileSync('d:/po/Storage_file/reel_data.csv', 'utf-8');
  const cleanContent = csvContent.replace(/^\uFEFF/, '');
  const records = parse(cleanContent, { columns: true, skip_empty_lines: true, trim: true });

  let totalOpeningRaw = 0;
  let totalOpeningParsed = 0;
  
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rawVal = row['Opening Weight'];
    
    // Attempt parsing exactly as the import script did:
    const parsedVal = Number(rawVal) || 0;
    
    // Also try a smarter parse (remove commas)
    const smartVal = Number((rawVal || '').replace(/,/g, '').trim()) || 0;

    totalOpeningParsed += parsedVal;
    totalOpeningRaw += smartVal;

    if (parsedVal !== smartVal) {
      console.log(`Row ${i + 2}: Reel No: ${row['Reel No']}, Raw Opening: "${rawVal}", Parsed: ${parsedVal}, Smart: ${smartVal}`);
    }
  }

  console.log(`\nTotal parsed by import script: ${totalOpeningParsed}`);
  console.log(`Total if we remove commas and trim: ${totalOpeningRaw}`);
}

checkCsv();
