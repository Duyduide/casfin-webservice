import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { SessionGuard } from '../auth/session.guard';
import { SyncModule } from '../sync/sync.module';
import { BankhubModule } from '../bankhub/bankhub.module';

@Module({
  imports: [SyncModule, BankhubModule],
  controllers: [AccountsController],
  providers: [AccountsService, SessionGuard],
  exports: [AccountsService],
})
export class AccountsModule {}
