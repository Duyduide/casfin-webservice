import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ example: 'uuid-account-id', description: 'ID ví nguồn' })
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({
    example: 'uuid-account-id',
    description: 'ID ví đích — bắt buộc khi type = transfer',
  })
  @IsUUID()
  @ValidateIf((o) => o.type === 'transfer')
  @IsNotEmpty()
  @IsOptional()
  toAccountId?: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.expense })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 50000, description: 'Số tiền (dương)' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'uuid-category-id' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Mua cafe buổi sáng' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ example: 'https://r2.example.com/bill.jpg' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: '2024-06-17T08:00:00.000Z' })
  @IsDateString()
  date: string;
}
