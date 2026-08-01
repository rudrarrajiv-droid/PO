import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getReels = async (req: Request, res: Response): Promise<void> => {
  try {
    const reels = await prisma.reelInventory.findMany({
      orderBy: { reelNo: 'asc' }
    });
    res.json(reels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reels' });
  }
};

export const createReelTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reelNo, paperType, size, bf, gsm, type, weight, remarks } = req.body;

    await prisma.$transaction(async (tx) => {
      let reel = await tx.reelInventory.findUnique({ where: { reelNo } });
      
      if (!reel) {
        if (type === 'OUT') {
          throw new Error('Cannot do OUT transaction for a new reel');
        }
        reel = await tx.reelInventory.create({
          data: {
            reelNo, paperType, size, bf, gsm,
            weightIn: weight, currentBalance: weight
          }
        });
      } else {
        if (type === 'IN') {
          reel = await tx.reelInventory.update({
            where: { id: reel.id },
            data: {
              weightIn: { increment: weight },
              currentBalance: { increment: weight }
            }
          });
        } else if (type === 'OUT') {
          if (reel.currentBalance < weight) {
            throw new Error('Insufficient balance in reel');
          }
          reel = await tx.reelInventory.update({
            where: { id: reel.id },
            data: {
              weightOut: { increment: weight },
              currentBalance: { decrement: weight }
            }
          });
        }
      }

      await tx.reelTransaction.create({
        data: {
          reelId: reel.id,
          type,
          weight,
          date: new Date(),
          remarks
        }
      });
    });

    res.status(201).json({ message: 'Transaction successful' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to process transaction' });
  }
};
