import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionUser } from './session.types';

@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = (req.session as any)?.user as SessionUser | null;

    if (!user) throw new UnauthorizedException('Chưa đăng nhập');
    return true;
  }
}
