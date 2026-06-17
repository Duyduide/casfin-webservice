import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { AccountsModule } from '../accounts/accounts.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { AiModule } from '../ai/ai.module';
import { SessionGuard } from '../auth/session.guard';

@Module({
  imports: [AccountsModule, BudgetsModule, AiModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, SessionGuard],
  exports: [TransactionsService],
})
export class TransactionsModule {}
