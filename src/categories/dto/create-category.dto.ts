import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Cà phê' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'coffee', description: 'Tên icon (theo thư viện icon của mobile)' })
  @IsString()
  @IsNotEmpty()
  icon: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.expense })
  @IsEnum(CategoryType)
  type: CategoryType;
}
