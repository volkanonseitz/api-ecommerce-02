/**
 * Seed minimal untuk RBAC: 4 role + 4 permission dengan nama yang sama
 * persis seperti App\Enums\Role / App\Enums\Permission di kode Laravel
 * lama, supaya RbacService (assignRole/grantPermission) langsung jalan.
 *
 * Jalankan: npx prisma db seed
 * (tambahkan  "prisma": { "seed": "ts-node prisma/seed.ts" }  di package.json)
 */
// import { PrismaClient } from '../generated/prisma/client';
import { PrismaClient } from '@prisma/client';
// import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// Padanan `protected string $guard_name = 'api';` di App\Models\User.php lama.
const GUARD_NAME = 'api';

const prisma = new PrismaClient();

const NAMES = ['super_admin', 'store_owner', 'staff', 'customer'] as const;

async function main() {
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
