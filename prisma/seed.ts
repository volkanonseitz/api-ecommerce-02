import 'dotenv/config';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

const GUARD_NAME = 'api';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL belum diset di environment (.env).');
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(connectionString),
});

const NAMES = ['super_admin', 'store_owner', 'staff', 'customer'] as const;

async function main() {
  try {
    for (const name of NAMES) {
      await prisma.role.upsert({
        where: { name_guardName: { name, guardName: GUARD_NAME } },
        create: { name, guardName: GUARD_NAME },
        update: {},
      });

      await prisma.permission.upsert({
        where: { name_guardName: { name, guardName: GUARD_NAME } },
        create: { name, guardName: GUARD_NAME },
        update: {},
      });
    }

    console.log('Seed roles & permissions selesai.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
