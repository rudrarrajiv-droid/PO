const xlsx = require('xlsx');
const fs = require('fs');

const workbook = xlsx.readFile('d:\\po\\Storage_file\\Job Card July 2026(1).xlsx');
const sheet = workbook.Sheets['3. Master Data'];
const rawData = xlsx.utils.sheet_to_json(sheet);

const formattedData = [];

for (const row of rawData) {
    const customerName = row['Customer Name'];
    const itemName = row['Item Name'];
    const artworkNo = String(row['Artwork No.'] || '');

    if (!customerName || !itemName) continue;

    // Build layers
    const layers = [];
    
    // Top
    if (row['Top']) layers.push({ layerName: 'Top', paperType: String(row['Top']), bf: String(row['BF1'] || ''), gsm: Number(row['GSM1'] || 0) });
    // P2 to P7
    if (row['P2']) layers.push({ layerName: 'P2', paperType: String(row['P2']), bf: String(row['BF2'] || ''), gsm: Number(row['GSM2'] || 0) });
    if (row['P3']) layers.push({ layerName: 'P3', paperType: String(row['P3']), bf: String(row['BF3'] || ''), gsm: Number(row['GSM3'] || 0) });
    if (row['P4']) layers.push({ layerName: 'P4', paperType: String(row['P4']), bf: String(row['BF4'] || ''), gsm: Number(row['GSM4'] || 0) });
    if (row['P5']) layers.push({ layerName: 'P5', paperType: String(row['P5']), bf: String(row['BF5'] || ''), gsm: Number(row['GSM5'] || 0) });
    if (row['P6']) layers.push({ layerName: 'P6', paperType: String(row['P6']), bf: String(row['BF6'] || ''), gsm: Number(row['GSM6'] || 0) });
    if (row['P7']) layers.push({ layerName: 'P7', paperType: String(row['P7']), bf: String(row['BF7'] || ''), gsm: Number(row['GSM7'] || 0) });

    const doc = {
        customerName: customerName,
        customerId: customerName.toLowerCase().replace(/\s+/g, '-'), // placeholder ID
        itemName: itemName,
        artworkNo: artworkNo,
        length: Number(row['Length'] || 0),
        width: Number(row['Width'] || 0),
        height: Number(row['Height'] || 0),
        color: String(row['Color'] || ''),
        reelSize: Number(row['Reel Size'] || 0),
        cutSize: Number(row['Cut Size'] || 0),
        ply: Number(row['Ply'] || 0),
        flute: String(row['Flute'] || ''),
        pinPasting: String(row['Pin/Pasting'] || ''),
        pinType: String(row['Pin Type'] || ''),
        pinQty: Number(row['Pin Qty'] || 0),
        creasing: String(row['Creasing'] || ''),
        ups: Number(row['Ups'] || 1),
        packing: String(row['Packing'] || ''),
        specialRequirement: String(row['Special Req'] || ''),
        layers: layers
    };

    formattedData.push(doc);
}

fs.writeFileSync('src/data/seedData.json', JSON.stringify(formattedData, null, 2));
console.log(`Parsed ${formattedData.length} records to src/data/seedData.json`);
