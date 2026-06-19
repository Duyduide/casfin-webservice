import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing all database data...');

  await prisma.$executeRaw`
    TRUNCATE TABLE
      "bank_link_tokens",
      "debt_payments",
      "budgets",
      "transactions",
      "debts",
      "accounts",
      "bank_connections",
      "categories",
      "users"
    CASCADE
  `;

  // session table is auto-created by connect-pg-simple — clear only if it exists
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'session'
      ) THEN
        TRUNCATE TABLE "session";
      END IF;
    END $$;
  `);

  console.log('Database cleared successfully.');
}

main()
  .catch((e) => {
    console.error('Failed to clear database:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
