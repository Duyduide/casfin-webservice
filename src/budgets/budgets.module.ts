import { Module } from '@nestjs/common';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [BudgetsController],
  providers: [BudgetsService, SessionGuard],
  exports: [BudgetsService],
})
export class BudgetsModule {}
