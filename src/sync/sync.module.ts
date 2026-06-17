import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { AccountsModule } from '../accounts/accounts.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [AccountsModule, TransactionsModule],
  providers: [SyncService],
})
export class SyncModule {}
