import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto';

// Không cho phép đổi type sau khi tạo — ảnh hưởng đến balance logic
export class UpdateTransactionDto extends PartialType(
  OmitType(CreateTransactionDto, ['type', 'accountId', 'toAccountId'] as const),
) {}
