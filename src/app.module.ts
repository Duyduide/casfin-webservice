import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { DebtsModule } from './debts/debts.module';
import { BudgetsModule } from './budgets/budgets.module';
import { StatisticsModule } from './statistics/statistics.module';
import { SyncModule } from './sync/sync.module';
import { UploadModule } from './upload/upload.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    AccountsModule,
    TransactionsModule,
    CategoriesModule,
    DebtsModule,
    BudgetsModule,
    StatisticsModule,
    SyncModule,
    UploadModule,
    AiModule,
  ],
})
export class AppModule {}
