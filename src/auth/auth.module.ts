import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { TokenRefreshMiddleware } from './token-refresh.middleware';
import { SessionGuard } from './session.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, OidcDiscoveryService, TokenRefreshMiddleware, SessionGuard],
  exports: [OidcDiscoveryService, SessionGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // TokenRefreshMiddleware chạy trên mọi route — middleware tự skip nếu không có refreshToken
    consumer.apply(TokenRefreshMiddleware).forRoutes('*');
  }
}
