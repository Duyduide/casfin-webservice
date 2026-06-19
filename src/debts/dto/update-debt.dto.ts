import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateDebtDto } from './create-debt.dto';

// Không cho phép đổi type (lend/borrow) và transactionIds sau khi tạo
export class UpdateDebtDto extends PartialType(
  OmitType(CreateDebtDto, ['type', 'transactionIds'] as const),
) {}
