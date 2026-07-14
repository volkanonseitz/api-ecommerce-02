import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined');
}

const adapter = new PrismaMariaDb(databaseUrl);

const prisma = new PrismaClient({
  adapter,
});

// Padanan `protected string $guard_name = 'api';`
const GUARD_NAME = 'api';

const NAMES = ['super_admin', 'store_owner', 'staff', 'customer'] as const;

async function main(): Promise<void> {
  for (const name of NAMES) {
    await prisma.role.upsert({
      where: {
        name_guardName: {
          name,
          guardName: GUARD_NAME,
        },
      },
      create: {
        name,
        guardName: GUARD_NAME,
      },
      update: {},
    });

    await prisma.permission.upsert({
      where: {
        name_guardName: {
          name,
          guardName: GUARD_NAME,
        },
      },
      create: {
        name,
        guardName: GUARD_NAME,
      },
      update: {},
    });
  }

  console.log('Seed roles & permissions selesai.');
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });