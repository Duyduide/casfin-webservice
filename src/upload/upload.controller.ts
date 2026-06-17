import { Controller, Post, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { SessionGuard } from '../auth/session.guard';

@Controller('upload')
@UseGuards(SessionGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // Upload ảnh bill/hóa đơn → Cloudflare R2 → trả về public URL
  // Mobile gọi endpoint này trước, lấy imageUrl rồi gắn vào transaction body
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadImage(file);
  }
}
