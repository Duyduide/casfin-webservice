import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'Ví tiền mặt' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.cash })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ example: 500000, description: 'Số dư ban đầu, mặc định 0' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  balance?: number;

  @ApiPropertyOptional({ example: 'VND', default: 'VND' })
  @IsString()
  @IsOptional()
  currency?: string;
}
