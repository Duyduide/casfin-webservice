import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class SuggestCategoryDto {
  @ApiProperty({ example: 'Grab xe về nhà', description: 'Ghi chú giao dịch (transaction.note)' })
  @IsString()
  @MinLength(1)
  description: string;

  @ApiProperty({ example: 35000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ enum: ['income', 'expense'], example: 'expense' })
  @IsOptional()
  @IsEnum(['income', 'expense'])
  type?: 'income' | 'expense';
}
