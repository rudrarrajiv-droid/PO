import xlsx from 'xlsx';
import prisma from '../utils/prisma';

const filePath = 'D:/po/JOB CARD/Job Card July 2026.xlsx';

async function importMasterData(workbook: xlsx.WorkBook) {
  console.log('Importing Master Data...');
  const sheet = workbook.Sheets['3. Master Data'];
  if (!sheet) return;

  const data: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  // Skip header row (index 0)
  let artCounter = 1;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || !row[2]) continue; // Skip empty rows (no customer or item name)

    const customerName = row[0].toString().trim();
    let artworkNo = row[1] ? row[1].toString().trim() : '';
    if (!artworkNo) {
      artworkNo = `UNKNOWN-${artCounter++}`;
    }
    const itemName = row[2].toString().trim();
    
    const length = Number(row[3]) || 0;
    const width = Number(row[4]) || 0;
    const height = Number(row[5]) || 0;
    const reelSize = Number(row[7]) || 0;
    const cutSize = Number(row[8]) || 0;
    const ply = Number(row[9]) || 3;
    const flute = row[10] ? row[10].toString() : 'B';
    const ups = Number(row[32]) || 1;

    // Find or create customer
    let customer = await prisma.customer.findFirst({ where: { name: customerName } });
    if (!customer) {
      customer = await prisma.customer.create({ data: { name: customerName } });
    }

    const existingProduct = await prisma.product.findFirst({
      where: { artworkNo }
    });

    if (!existingProduct) {
      const product = await prisma.product.create({
        data: {
          customerId: customer.id,
          itemName,
          artworkNo,
          length,
          width,
          height,
          reelSize,
          cutSize,
          ply,
          flute,
          ups
        }
      });

      // Create layers
      const layers = [];
      const layerNames = ['Top', 'Flute 1', 'Liner 1', 'Flute 2', 'Liner 2', 'Flute 3', 'Liner 3'];
      let colIdx = 11; // Top paper type
      
      for (let l = 0; l < layerNames.length; l++) {
        const paperType = row[colIdx];
        const bf = row[colIdx + 1];
        const gsm = row[colIdx + 2];
        
        if (paperType || bf || gsm) {
          layers.push({
            productId: product.id,
            layerName: layerNames[l],
            paperType: paperType ? paperType.toString() : '',
            bf: bf ? bf.toString() : '',
            gsm: Number(gsm) || 0
          });
        }
        colIdx += 3;
      }

      if (layers.length > 0) {
        // SQLite doesn't support createMany with related fields easily in some versions or we just map them
        for (const layer of layers) {
          await prisma.productLayer.create({ data: layer });
        }
      }
    }
  }
  console.log('Master Data Import Complete.');
}

async function importReels(workbook: xlsx.WorkBook) {
  console.log('Importing Reel Inventory...');
  const sheet = workbook.Sheets['6. Reel Inventory'];
  if (!sheet) return;

  const data: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  // row 0 is header, row 1 is subheader, data starts at row 2
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row[2]) continue; // Skip if no Reel No

    const reelNo = row[2].toString().trim();
    const paperType = row[1] ? row[1].toString().trim() : '';
    const size = Number(row[3]) || 0;
    const bf = row[4] ? row[4].toString() : '';
    const gsm = Number(row[5]) || 0;
    const closingBalance = Number(row[6]) || 0;
    // For older reels, we just treat the closing balance as the opening balance in our system
    
    const existing = await prisma.reelInventory.findUnique({ where: { reelNo } });
    if (!existing) {
      const newReel = await prisma.reelInventory.create({
        data: {
          reelNo,
          paperType,
          size,
          bf,
          gsm,
          currentBalance: closingBalance,
          weightIn: closingBalance, // Assuming starting stock
          weightOut: 0
        }
      });
      // Add initial transaction
      await prisma.reelTransaction.create({
        data: {
          reelId: newReel.id,
          type: 'IN',
          weight: closingBalance,
          date: new Date(),
          remarks: 'Initial Import'
        }
      });
    }
  }
  console.log('Reel Inventory Import Complete.');
}

async function run() {
  console.log('Reading Excel File...');
  const workbook = xlsx.readFile(filePath);
  
  await importMasterData(workbook);
  await importReels(workbook);
  
  // We skip '2. Data Base' Job Cards for now unless specifically needed, 
  // because historical job cards often lack the FKs to products if product names changed,
  // but let's do a basic import if they exist.
  // Actually, importing Master Data and Reels is usually sufficient to start fresh.
  
  console.log('Data Migration Complete!');
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
