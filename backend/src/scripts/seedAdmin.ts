import bcrypt from 'bcrypt';
import prisma from '../utils/prisma';

async function main() {
  const email = 'admin@packwell.com';
  const password = 'admin123';
  const name = 'Admin';
  
  const existingUser = await prisma.user.findUnique({ where: { email } });
  
  if (existingUser) {
    console.log('Admin user already exists.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'Admin',
      isActive: true,
    },
  });

  console.log(`Admin user created: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
