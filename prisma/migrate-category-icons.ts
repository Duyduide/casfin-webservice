import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ICON_MIGRATION_MAP: Record<string, string> = {
  'fork-knife':    '🍜',
  'car':           '🚗',
  'shopping-bag':  '🛍️',
  'gamepad':       '🎮',
  'heart-pulse':   '💊',
  'graduation-cap':'🎓',
  'zap':           '⚡',
  'home':          '🏠',
  'shirt':         '👕',
  'ellipsis':      '💰',
  'banknote':      '💵',
  'gift':          '🎁',
  'trending-up':   '📈',
  'laptop':        '💻',
};

const DRY_RUN = process.env.DRY_RUN !== 'false';

async function main() {
  console.log(`\n=== Migrate Default Category Icons ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (set DRY_RUN=false để thực sự update)' : 'LIVE'}\n`);

  const oldIcons = Object.keys(ICON_MIGRATION_MAP);

  const staleCategories = await prisma.category.findMany({
    where: {
      isDefault: true,
      icon: { in: oldIcons },
    },
    select: { id: true, name: true, icon: true, type: true, userId: true },
  });

  if (staleCategories.length === 0) {
    console.log('Không tìm thấy category nào cần migrate. DB đã up-to-date.');
    return;
  }

  const affectedUsers = new Set(staleCategories.map((c) => c.userId)).size;
  console.log(`Tìm thấy ${staleCategories.length} categories cần update (thuộc ${affectedUsers} user):\n`);

  const grouped: Record<string, number> = {};
  for (const cat of staleCategories) {
    const key = `${cat.icon} → ${ICON_MIGRATION_MAP[cat.icon]}`;
    grouped[key] = (grouped[key] ?? 0) + 1;
  }
  for (const [mapping, count] of Object.entries(grouped)) {
    console.log(`  ${mapping}  (${count} rows)`);
  }

  if (DRY_RUN) {
    console.log('\nDry run — không có gì được thay đổi.');
    return;
  }

  console.log('\nBắt đầu update...');
  let totalUpdated = 0;

  for (const [oldIcon, newIcon] of Object.entries(ICON_MIGRATION_MAP)) {
    const result = await prisma.category.updateMany({
      where: { isDefault: true, icon: oldIcon },
      data: { icon: newIcon },
    });
    if (result.count > 0) {
      console.log(`  ✓ "${oldIcon}" → "${newIcon}"  (${result.count} rows)`);
      totalUpdated += result.count;
    }
  }

  console.log(`\nHoàn tất: đã update ${totalUpdated} categories.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
