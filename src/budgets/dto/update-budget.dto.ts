import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateBudgetDto } from './create-budget.dto';

// Không cho phép đổi categoryId và period — là composite unique key
export class UpdateBudgetDto extends PartialType(
  OmitType(CreateBudgetDto, ['categoryId', 'period'] as const),
) {}
