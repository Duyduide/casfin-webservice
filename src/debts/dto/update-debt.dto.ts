import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateDebtDto } from './create-debt.dto';

// Không cho phép đổi type (lend/borrow) sau khi tạo
export class UpdateDebtDto extends PartialType(
  OmitType(CreateDebtDto, ['type'] as const),
) {}
