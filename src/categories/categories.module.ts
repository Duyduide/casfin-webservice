import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, SessionGuard],
  exports: [CategoriesService],
})
export class CategoriesModule {}
