import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, SessionGuard],
  exports: [AccountsService],
})
export class AccountsModule {}
