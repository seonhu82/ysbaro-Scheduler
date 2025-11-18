const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    console.log('Creating SUPER_ADMIN account...');

    const passwordHash = await bcrypt.hash('SuperAdmin2025!', 10);

    const superAdmin = await prisma.user.create({
      data: {
        email: 'iamhu@gmail.com',
        password: passwordHash,
        name: '시스템 관리자',
        role: 'SUPER_ADMIN',
        accountStatus: 'APPROVED',
        approvedAt: new Date(),
        clinicId: null
      }
    });

    console.log('✅ SUPER_ADMIN account created successfully!');
    console.log(`Email: ${superAdmin.email}`);
    console.log(`Password: SuperAdmin2025!`);
    console.log(`Role: ${superAdmin.role}`);

  } catch (error) {
    console.error('❌ Failed to create SUPER_ADMIN:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
