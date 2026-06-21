import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionUser } from './session.types';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = (req.session as any)?.user as SessionUser | null;

    if (!user) {
      this.logger.warn(
        `401 ${req.method} ${req.url} | sessionID=${req.sessionID ?? 'none'} | cookie=${req.headers.cookie ?? 'none'} | sessionKeys=${Object.keys(req.session ?? {}).join(',')}`,
      );
      throw new UnauthorizedException('Chưa đăng nhập');
    }
    return true;
  }
}
