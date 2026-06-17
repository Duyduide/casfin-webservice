import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [StatisticsController],
  providers: [StatisticsService, SessionGuard],
})
export class StatisticsModule {}
