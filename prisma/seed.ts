import { PrismaClient } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '../src/categories/default-categories.constant';

const prisma = new PrismaClient();

// Seed categories cho 1 user — dùng trong UsersService.findOrCreate() thay vì đây
// File này chỉ là entry point khi chạy `prisma db seed` (dev utility)
export async function seedCategoriesForUser(userId: string) {
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      userId,
      isDefault: true,
    })),
  });
}

async function main() {
  console.log('Seed file này không tạo data mặc định.');
  console.log('Default categories được seed tự động khi user đăng nhập lần đầu.');
  console.log('Dùng seedCategoriesForUser(userId) nếu cần seed thủ công.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
