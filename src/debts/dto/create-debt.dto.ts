import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DebtType } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateDebtDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên người vay/cho vay' })
  @IsString()
  @MinLength(1)
  contactName: string;

  @ApiProperty({ enum: DebtType, example: DebtType.lend, description: 'lend = mình cho vay, borrow = mình đi vay' })
  @IsEnum(DebtType)
  type: DebtType;

  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'Mượn tiền mua laptop' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ example: '2024-12-31T00:00:00.000Z', description: 'Hạn trả nợ' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
