import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class SuggestCategoryDto {
  @ApiProperty({ example: 'Grab xe về nhà', description: 'Mô tả giao dịch' })
  @IsString()
  @MinLength(1)
  description: string;

  @ApiProperty({ example: 35000 })
  @IsNumber()
  @Min(0)
  amount: number;
}
