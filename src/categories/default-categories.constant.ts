import { CategoryType } from '@prisma/client';

export const DEFAULT_CATEGORIES: {
  name: string;
  icon: string;
  type: CategoryType;
}[] = [
  // Chi tiêu
  { name: 'Ăn uống', icon: '🍜', type: 'expense' },
  { name: 'Di chuyển', icon: '🚗', type: 'expense' },
  { name: 'Mua sắm', icon: '🛍️', type: 'expense' },
  { name: 'Giải trí', icon: '🎮', type: 'expense' },
  { name: 'Sức khỏe', icon: '💊', type: 'expense' },
  { name: 'Giáo dục', icon: '🎓', type: 'expense' },
  { name: 'Hóa đơn & Tiện ích', icon: '⚡', type: 'expense' },
  { name: 'Nhà ở', icon: '🏠', type: 'expense' },
  { name: 'Quần áo', icon: '👕', type: 'expense' },
  { name: 'Khác', icon: '💰', type: 'expense' },
  // Thu nhập
  { name: 'Lương', icon: '💵', type: 'income' },
  { name: 'Thưởng', icon: '🎁', type: 'income' },
  { name: 'Đầu tư', icon: '📈', type: 'income' },
  { name: 'Freelance', icon: '💻', type: 'income' },
  { name: 'Khác', icon: '💰', type: 'income' },
];
