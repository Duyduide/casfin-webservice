import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { SessionGuard } from '../auth/session.guard';

@Module({
  controllers: [UploadController],
  providers: [UploadService, SessionGuard],
  exports: [UploadService],
})
export class UploadModule {}
