import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { generateJobCardPDF } from '../services/pdfGenerator';

export const getJobCards = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobCards = await prisma.jobCard.findMany({
      include: {
        product: {
          include: { customer: true }
        },
        createdBy: { select: { name: true } }
      },
      orderBy: { targetDate: 'asc' }
    });
    res.json(jobCards);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job cards' });
  }
};

export const createJobCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobCardNo, targetDate, productId, orderQty, priority, remarks } = req.body;
    
    // Fetch product to calculate weights
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { layers: true }
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // --- Calculation Logic exactly matching GAS ---
    const ups = product.ups > 0 ? product.ups : 1;
    const noOfPaper = Math.ceil(orderQty / ups);
    
    let totalWeight = 0;
    
    // In GAS, r=18 to 24 correspond to layers: Top, Flute 1, Liner 2, Flute 2, Liner 3, Flute 3, Liner 4
    // Flute layers (r=19, 21, 23) get 1.4 multiplier. We can infer this by layerName containing "Flute"
    
    for (const layer of product.layers) {
      let gsm = layer.gsm || 0;
      if (gsm > 0 && product.reelSize > 0 && product.cutSize > 0) {
        let eff_gsm = gsm;
        if (layer.layerName.toLowerCase().includes('flute')) {
          eff_gsm = gsm * 1.4;
        }
        
        let layerWeight = (product.reelSize * product.cutSize * eff_gsm) / 3100 / 500 * noOfPaper;
        layerWeight = Math.round(layerWeight * 100) / 100;
        totalWeight += layerWeight;
      }
    }
    
    totalWeight = Math.round(totalWeight * 100) / 100;
    const oneBoxWeight = orderQty > 0 ? Math.round((totalWeight / orderQty) * 100) / 100 : 0;

    // TODO: Add Reel Allocation logic here to check if totalWeight is available in inventory

    const userId = (req as any).user.userId;

    const jobCard = await prisma.jobCard.create({
      data: {
        jobCardNo,
        targetDate: new Date(targetDate),
        productId,
        orderQty,
        oneBoxWeight,
        totalWeight,
        priority,
        remarks,
        createdById: userId
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE_JOB_CARD',
        entity: 'JobCard',
        entityId: jobCard.id,
        userId: userId
      }
    });

    res.status(201).json(jobCard);
  } catch (error) {
    console.error('Error creating Job Card:', error);
    res.status(500).json({ error: 'Failed to create job card' });
  }
};

export const downloadJobCardPDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const jobCard = await prisma.jobCard.findUnique({
      where: { id: Number(id) },
      include: {
        product: {
          include: { customer: true, layers: true }
        },
        createdBy: { select: { name: true } }
      }
    });

    if (!jobCard) {
      res.status(404).json({ error: 'Job Card not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=JobCard_${jobCard.jobCardNo}.pdf`);
    
    generateJobCardPDF(jobCard, res);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

export const getNextJobCardNo = async (req: Request, res: Response): Promise<void> => {
  try {
    const latestJobCard = await prisma.jobCard.findFirst({
      where: {
        jobCardNo: { startsWith: 'PI/JC/' }
      },
      orderBy: { id: 'desc' }
    });

    if (!latestJobCard) {
      res.json({ nextNo: 'PI/JC/1001' });
      return;
    }

    // Extract the number part
    const parts = latestJobCard.jobCardNo.split('/');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    
    if (isNaN(lastNum)) {
      res.json({ nextNo: 'PI/JC/1001' });
      return;
    }

    const nextNo = `PI/JC/${lastNum + 1}`;
    res.json({ nextNo });
  } catch (error) {
    console.error('Error fetching next job card no:', error);
    res.status(500).json({ error: 'Failed to get next job card no' });
  }
};
