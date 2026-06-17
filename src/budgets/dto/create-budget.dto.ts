import { ApiProperty } from '@nestjs/swagger';
import { BudgetPeriod } from '@prisma/client';
import { IsEnum, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateBudgetDto {
  @ApiProperty({ example: 'uuid-category-id', description: 'Category muốn đặt hạn mức' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 2000000, description: 'Hạn mức chi tiêu trong kỳ (VND)' })
  @IsNumber()
  @Min(1)
  limitAmount: number;

  @ApiProperty({ enum: BudgetPeriod, example: BudgetPeriod.monthly })
  @IsEnum(BudgetPeriod)
  period: BudgetPeriod;
}
