import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getProductionLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobCardId } = req.params;
    
    if (jobCardId) {
      const logs = await prisma.productionTracking.findMany({
        where: { jobCardId: Number(jobCardId) },
        orderBy: { recordedAt: 'desc' }
      });
      res.json(logs);
      return;
    }
    
    res.status(400).json({ error: 'Job Card ID is required' });
  } catch (error: any) {
    console.error('Error fetching production logs:', error);
    res.status(500).json({ error: 'Failed to fetch production logs' });
  }
};

export const addProductionLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobCardId, department, productionQty, operatorName, supervisorSign } = req.body;

    if (!jobCardId || !department || !productionQty) {
      res.status(400).json({ error: 'Job Card ID, department, and production quantity are required' });
      return;
    }

    const log = await prisma.productionTracking.create({
      data: {
        jobCardId: Number(jobCardId),
        department,
        productionQty: Number(productionQty),
        operatorName,
        supervisorSign
      }
    });

    res.status(201).json(log);
  } catch (error: any) {
    console.error('Error adding production log:', error);
    res.status(500).json({ error: 'Failed to add production log' });
  }
};
