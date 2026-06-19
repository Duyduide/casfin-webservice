import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AddPaymentDto {
  @ApiProperty({
    example: 'uuid-transaction-id',
    description: 'ID giao dịch "Thu nợ"/"Trả nợ" dùng để ghi nhận thanh toán này',
  })
  @IsUUID('4')
  transactionId: string;

  @ApiPropertyOptional({ example: 'Trả một phần' })
  @IsString()
  @IsOptional()
  note?: string;
}
