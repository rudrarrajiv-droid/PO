import PDFDocument from 'pdfkit';
import path from 'path';

export const generateJobCardPDF = (jobCard: any, res: any) => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  
  // Pipe its output to the response
  doc.pipe(res);

  // Logo & Header
  const logoPath = path.join(__dirname, '../../assets/logo.gif');
  try {
    doc.image(logoPath, 40, 40, { width: 80 });
  } catch (e) {
    // If logo fails to load, just continue
  }

  doc.font('Helvetica-Bold')
     .fontSize(20)
     .text('PACKWELL INDIA', 130, 45);
     
  doc.font('Helvetica')
     .fontSize(10)
     .text('Industrial Packaging Solutions', 130, 68);

  // Document Number & Title
  doc.rect(40, 95, 515, 25).stroke();
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .text('JOB CARD / PRODUCTION PLAN', 0, 101, { align: 'center' });
  doc.font('Helvetica')
     .fontSize(10)
     .text('Doc No: F/QA/016', 440, 103);

  // Top Section: Info
  doc.rect(40, 130, 515, 100).stroke();
  doc.moveTo(297, 130).lineTo(297, 230).stroke(); // vertical divider
  
  // Left side info
  doc.font('Helvetica-Bold').fontSize(10).text('Job Card No:', 45, 140);
  doc.font('Helvetica').text(jobCard.jobCardNo, 120, 140);
  
  doc.font('Helvetica-Bold').text('Customer:', 45, 160);
  doc.font('Helvetica').text(jobCard.product.customer.name, 120, 160);

  doc.font('Helvetica-Bold').text('Item Name:', 45, 180);
  doc.font('Helvetica').text(jobCard.product.itemName, 120, 180);

  doc.font('Helvetica-Bold').text('Order Qty:', 45, 200);
  doc.font('Helvetica').text(jobCard.orderQty.toString(), 120, 200);

  // Right side info
  doc.font('Helvetica-Bold').text('Target Date:', 305, 140);
  doc.font('Helvetica').text(new Date(jobCard.targetDate).toLocaleDateString(), 380, 140);

  doc.font('Helvetica-Bold').text('Dimensions:', 305, 160);
  doc.font('Helvetica').text(`${jobCard.product.length} x ${jobCard.product.width} x ${jobCard.product.height} inch`, 380, 160);

  doc.font('Helvetica-Bold').text('Ply & Flute:', 305, 180);
  doc.font('Helvetica').text(`${jobCard.product.ply} Ply, '${jobCard.product.flute}' Flute`, 380, 180);

  doc.font('Helvetica-Bold').text('Ups:', 305, 200);
  doc.font('Helvetica').text(jobCard.product.ups.toString(), 380, 200);

  // Paper Layers Table
  doc.font('Helvetica-Bold').fontSize(12).text('Paper Specifications', 40, 250);
  
  const tableTop = 270;
  const colX = [40, 130, 230, 280, 340, 420, 490];
  
  // Table Header
  doc.rect(40, tableTop, 515, 20).fillAndStroke('#eeeeee', '#000000');
  doc.fillColor('black').font('Helvetica-Bold').fontSize(10);
  doc.text('Layer', colX[0] + 5, tableTop + 5);
  doc.text('Paper Type', colX[1] + 5, tableTop + 5);
  doc.text('BF', colX[2] + 5, tableTop + 5);
  doc.text('GSM', colX[3] + 5, tableTop + 5);
  doc.text('Reel x Cut', colX[4] + 5, tableTop + 5);
  doc.text('Weight (Kg)', colX[5] + 5, tableTop + 5);
  
  let y = tableTop + 20;
  
  // Calculate weights again or distribute from totalWeight for the PDF
  const ups = jobCard.product.ups > 0 ? jobCard.product.ups : 1;
  const noOfPaper = Math.ceil(jobCard.orderQty / ups);
  
  doc.font('Helvetica').fontSize(9);
  
  jobCard.product.layers.forEach((layer: any, i: number) => {
    doc.rect(40, y, 515, 20).stroke();
    
    // Weight calc for this layer
    let gsm = layer.gsm || 0;
    let layerWeight = 0;
    if (gsm > 0 && jobCard.product.reelSize > 0 && jobCard.product.cutSize > 0) {
      let eff_gsm = gsm;
      if (layer.layerName.toLowerCase().includes('flute')) eff_gsm = gsm * 1.4;
      layerWeight = Math.round(((jobCard.product.reelSize * jobCard.product.cutSize * eff_gsm) / 3100 / 500 * noOfPaper) * 100) / 100;
    }

    doc.text(layer.layerName, colX[0] + 5, y + 5);
    doc.text(layer.paperType || '-', colX[1] + 5, y + 5);
    doc.text(layer.bf || '-', colX[2] + 5, y + 5);
    doc.text(layer.gsm?.toString() || '-', colX[3] + 5, y + 5);
    doc.text(`${jobCard.product.reelSize}" x ${jobCard.product.cutSize}"`, colX[4] + 5, y + 5);
    doc.text(layerWeight.toString(), colX[5] + 5, y + 5);
    
    y += 20;
  });

  // Total Weight Row
  doc.rect(40, y, 515, 20).stroke();
  doc.font('Helvetica-Bold');
  doc.text('Total Estimated Weight:', colX[0] + 5, y + 5);
  doc.text(`${jobCard.totalWeight} Kg`, colX[5] + 5, y + 5);
  
  // Production Tracking Table
  y += 40;
  doc.fontSize(12).text('Production Plan & Tracking', 40, y);
  y += 20;
  
  const pTableTop = y;
  const pColX = [40, 160, 260, 360, 460];
  
  doc.rect(40, pTableTop, 515, 20).fillAndStroke('#eeeeee', '#000000');
  doc.fillColor('black').font('Helvetica-Bold').fontSize(10);
  doc.text('Department', pColX[0] + 5, pTableTop + 5);
  doc.text('Date', pColX[1] + 5, pTableTop + 5);
  doc.text('Qty Produced', pColX[2] + 5, pTableTop + 5);
  doc.text('Operator', pColX[3] + 5, pTableTop + 5);
  doc.text('Sign', pColX[4] + 5, pTableTop + 5);
  
  let pY = pTableTop + 20;
  const depts = ['Corrugation', 'Pasting', 'Cutting / Creasing', 'Printing / Slotting', 'Stitching / Gluing', 'Dispatch'];
  
  doc.font('Helvetica').fontSize(10);
  depts.forEach(dept => {
    doc.rect(40, pY, 515, 25).stroke();
    doc.text(dept, pColX[0] + 5, pY + 7);
    pY += 25;
  });

  // Footer / Signatures
  pY += 50;
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Prepared By', 40, pY);
  doc.text('Production Manager', 250, pY);
  doc.text('Authorized Signatory', 430, pY);

  doc.end();
};
