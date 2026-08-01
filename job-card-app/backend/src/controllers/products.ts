import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      include: {
        customer: true,
        layers: true
      },
      orderBy: { itemName: 'asc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      artworkNo, itemName, customerId, length, width, height, color,
      ply, flute, reelSize, cutSize, pinQty, pinPasting, ups, creasing,
      packing, specialReq, layers
    } = req.body;

    // Start a transaction to create product and layers
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          artworkNo, itemName, customerId, length, width, height, color,
          ply, flute, reelSize, cutSize, pinQty, pinPasting, ups, creasing,
          packing, specialReq
        }
      });

      if (layers && layers.length > 0) {
        const layerData = layers.map((layer: any) => ({
          productId: newProduct.id,
          layerName: layer.layerName,
          paperType: layer.paperType,
          bf: layer.bf,
          gsm: layer.gsm
        }));
        await tx.productLayer.createMany({ data: layerData });
      }

      return newProduct;
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};
