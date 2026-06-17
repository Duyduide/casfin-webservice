import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionUser } from '../session.types';

// Dùng trong controller để lấy user hiện tại từ session
// Yêu cầu route đã được bảo vệ bởi SessionGuard
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const req = ctx.switchToHttp().getRequest();
    return (req.session as any)?.user;
  },
);
