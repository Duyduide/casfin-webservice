import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { BankhubModule } from '../bankhub/bankhub.module';

@Module({
  imports: [BankhubModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
