import { CategoryType } from '@prisma/client';

export const DEFAULT_CATEGORIES: {
  name: string;
  icon: string;
  type: CategoryType;
}[] = [
  // Chi tiêu
  { name: 'Ăn uống', icon: 'fork-knife', type: 'expense' },
  { name: 'Di chuyển', icon: 'car', type: 'expense' },
  { name: 'Mua sắm', icon: 'shopping-bag', type: 'expense' },
  { name: 'Giải trí', icon: 'gamepad', type: 'expense' },
  { name: 'Sức khỏe', icon: 'heart-pulse', type: 'expense' },
  { name: 'Giáo dục', icon: 'graduation-cap', type: 'expense' },
  { name: 'Hóa đơn & Tiện ích', icon: 'zap', type: 'expense' },
  { name: 'Nhà ở', icon: 'home', type: 'expense' },
  { name: 'Quần áo', icon: 'shirt', type: 'expense' },
  { name: 'Khác', icon: 'ellipsis', type: 'expense' },
  // Thu nhập
  { name: 'Lương', icon: 'banknote', type: 'income' },
  { name: 'Thưởng', icon: 'gift', type: 'income' },
  { name: 'Đầu tư', icon: 'trending-up', type: 'income' },
  { name: 'Freelance', icon: 'laptop', type: 'income' },
  { name: 'Khác', icon: 'ellipsis', type: 'income' },
];
