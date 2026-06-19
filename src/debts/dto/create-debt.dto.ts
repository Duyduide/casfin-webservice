import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DebtType } from '@prisma/client';
import { ArrayMinSize, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateDebtDto {
  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên người vay/cho vay' })
  @IsString()
  @MinLength(1)
  contactName: string;

  @ApiProperty({ enum: DebtType, example: DebtType.lend, description: 'lend = mình cho vay, borrow = mình đi vay' })
  @IsEnum(DebtType)
  type: DebtType;

  @ApiProperty({
    type: [String],
    example: ['uuid-tx-1', 'uuid-tx-2'],
    description: 'Danh sách ID giao dịch "Cho vay"/"Đi vay" làm nguồn của khoản nợ này',
  })
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  transactionIds: string[];

  @ApiPropertyOptional({ example: 'Mượn tiền mua laptop' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ example: '2024-12-31T00:00:00.000Z', description: 'Hạn trả nợ' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
