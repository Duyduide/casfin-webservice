import { Module } from '@nestjs/common';
import { BankhubService } from './bankhub.service';

@Module({
  providers: [BankhubService],
  exports: [BankhubService],
})
export class BankhubModule {}
