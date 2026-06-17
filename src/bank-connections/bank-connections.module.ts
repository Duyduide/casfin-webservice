import { Module } from '@nestjs/common';
import { BankConnectionsController } from './bank-connections.controller';
import { BankConnectionsService } from './bank-connections.service';
import { SessionGuard } from '../auth/session.guard';
import { BankhubModule } from '../bankhub/bankhub.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [BankhubModule, SyncModule],
  controllers: [BankConnectionsController],
  providers: [BankConnectionsService, SessionGuard],
})
export class BankConnectionsModule {}
