import { Module } from '@nestjs/common';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [DebtsController],
  providers: [DebtsService, SessionGuard],
})
export class DebtsModule {}
