import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@packwell.com' },
    update: {},
    create: {
      email: 'admin@packwell.com',
      name: 'Administrator',
      password: hashedPassword,
      role: 'Admin',
    },
  });

  const customer = await prisma.customer.upsert({
    where: { name: 'Test Customer' },
    update: {},
    create: { name: 'Test Customer' }
  });

  const product = await prisma.product.upsert({
    where: { artworkNo: 'ART-001' },
    update: {},
    create: {
      artworkNo: 'ART-001',
      itemName: 'Sample Corrugated Box',
      customerId: customer.id,
      length: 12,
      width: 10,
      height: 8,
      color: 'Brown',
      ply: 3,
      flute: 'C',
      reelSize: 32,
      cutSize: 40,
      ups: 1,
      layers: {
        create: [
          { layerName: 'Top', paperType: 'Kraft', bf: '18', gsm: 150 },
          { layerName: 'Flute 1', paperType: 'Semi-Kraft', bf: '16', gsm: 120 },
          { layerName: 'Liner 2', paperType: 'Kraft', bf: '18', gsm: 150 },
        ]
      }
    }
  });

  console.log({ admin, customer, product });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
