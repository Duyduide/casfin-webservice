-- AlterTable: Category — thêm cột is_debt_related
ALTER TABLE "categories" ADD COLUMN "is_debt_related" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Transaction — thêm FK debt_id (nullable, SET NULL khi xóa debt)
ALTER TABLE "transactions" ADD COLUMN "debt_id" TEXT;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_debt_id_fkey"
  FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: DebtPayment — thêm FK transaction_id (nullable, unique, SET NULL khi xóa transaction)
ALTER TABLE "debt_payments" ADD COLUMN "transaction_id" TEXT;
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_transaction_id_key" UNIQUE ("transaction_id");
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: thêm 4 category mới cho tất cả users hiện tại
INSERT INTO "categories" ("id", "user_id", "name", "icon", "type", "is_default", "is_debt_related", "created_at", "updated_at")
SELECT gen_random_uuid(), u."id", 'Cho vay', '🤝', 'expense'::"CategoryType", true, true, NOW(), NOW()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c WHERE c."user_id" = u."id" AND c."name" = 'Cho vay'
);

INSERT INTO "categories" ("id", "user_id", "name", "icon", "type", "is_default", "is_debt_related", "created_at", "updated_at")
SELECT gen_random_uuid(), u."id", 'Đi vay', '💸', 'income'::"CategoryType", true, true, NOW(), NOW()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c WHERE c."user_id" = u."id" AND c."name" = 'Đi vay'
);

INSERT INTO "categories" ("id", "user_id", "name", "icon", "type", "is_default", "is_debt_related", "created_at", "updated_at")
SELECT gen_random_uuid(), u."id", 'Thu nợ', '💰', 'income'::"CategoryType", true, true, NOW(), NOW()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c WHERE c."user_id" = u."id" AND c."name" = 'Thu nợ'
);

INSERT INTO "categories" ("id", "user_id", "name", "icon", "type", "is_default", "is_debt_related", "created_at", "updated_at")
SELECT gen_random_uuid(), u."id", 'Trả nợ', '🏦', 'expense'::"CategoryType", true, true, NOW(), NOW()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c WHERE c."user_id" = u."id" AND c."name" = 'Trả nợ'
);
