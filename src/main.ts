import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as session from 'express-session';
import * as connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      // Tắt contentSecurityPolicy để Swagger UI load được inline scripts
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    }),
  );

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const PgSession = connectPgSimple(session);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  // ── Swagger ──────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('CasFin API')
      .setDescription(
        'Backend API cho ứng dụng quản lý thu chi cá nhân.\n\n' +
        '**Auth:** Truy cập `/api/auth/login` để đăng nhập qua Casso SSO trước, ' +
        'sau đó session cookie sẽ tự động gắn vào các request.',
      )
      .setVersion('1.0')
      .addCookieAuth('connect.sid', {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
        description: 'Session cookie nhận được sau khi đăng nhập qua /api/auth/login',
      })
      .addTag('auth', 'Đăng nhập / đăng xuất qua Casso SSO')
      .addTag('accounts', 'Quản lý ví / tài khoản')
      .addTag('transactions', 'Ghi chép giao dịch thu chi')
      .addTag('categories', 'Danh mục giao dịch')
      .addTag('debts', 'Sổ nợ — vay mượn')
      .addTag('budgets', 'Hũ chi tiêu (Money Pots)')
      .addTag('statistics', 'Thống kê & báo cáo')
      .addTag('upload', 'Upload ảnh hóa đơn')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
      },
    });

    console.log(`Swagger UI: http://localhost:${process.env.PORT ?? 3000}/api/docs`);
  }

  // BankHub redirect về root (http://localhost:3000?publicToken=xxx) → forward sang callback
  app.use((req: any, res: any, next: any) => {
    if (req.path === '/' && req.query.publicToken) {
      return res.redirect(`/api/bank-connections/callback?publicToken=${req.query.publicToken}`);
    }
    next();
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`CasFin API running on port ${port}`);
}

bootstrap();
