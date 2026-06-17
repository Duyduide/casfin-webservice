import { Controller, Post, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { SessionGuard } from '../auth/session.guard';

@ApiTags('upload')
@ApiCookieAuth()
@Controller('upload')
@UseGuards(SessionGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload ảnh hóa đơn lên Cloudflare R2' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'File ảnh (jpg, png, webp)' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'URL ảnh trên R2',
    schema: { example: { url: 'https://pub-xxx.r2.dev/transactions/uuid.jpg' } },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadImage(file);
  }
}
