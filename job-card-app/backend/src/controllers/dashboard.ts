import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalOrders = await prisma.jobCard.count();
    const pending = await prisma.jobCard.count({ where: { status: 'Pending' } });
    const inProcess = await prisma.jobCard.count({ where: { status: 'Issued' } });
    const completed = await prisma.jobCard.count({ where: { status: 'Completed' } });
    
    const recentActivities = await prisma.auditLog.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
      include: { user: { select: { name: true } } }
    });

    res.json({
      totalOrders,
      pending,
      inProcess,
      completed,
      recentActivities
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};
