import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddPaymentDto {
  @ApiProperty({ example: 200000, description: 'Số tiền trả lần này (có thể partial)' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'Trả một phần' })
  @IsString()
  @IsOptional()
  note?: string;
}
