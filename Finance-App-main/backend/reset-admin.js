require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@loanflow.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const name = process.env.ADMIN_NAME || 'Super Admin';
  const companyId = 'company-finova-001';

  try {
    // Ensure company exists
    let company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      company = await prisma.company.create({
        data: {
          id: companyId,
          code: 'FINOVA',
          name: 'Finova Financials',
          ownerName: name,
          phone: '9999999999',
          isActive: true,
        }
      });
      console.log('✓ Company created:', company.name);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Find existing admin by email
    const existing = await prisma.user.findFirst({ where: { email } });

    let user;
    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, name, role: 'ADMIN', isActive: true }
      });
      console.log('✓ Existing user updated.');
    } else {
      user = await prisma.user.create({
        data: {
          name,
          email,
          phone: '9999999999',
          passwordHash,
          role: 'ADMIN',
          companyId,
        }
      });
      console.log('✓ New admin user created.');
    }

    console.log('');
    console.log('✅ Login credentials are ready!');
    console.log('   Email   :', user.email);
    console.log('   Password:', password);
    console.log('   Role    :', user.role);
    console.log('');
    console.log('👉 Restart the server and log in with these credentials.');
    console.log('');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdmin();
