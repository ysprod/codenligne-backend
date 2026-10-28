import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

function parseCookies(rawCookieHeader: string | undefined): Record<string, string> {
  if (!rawCookieHeader) return {};
  return rawCookieHeader.split(';').reduce<Record<string, string>>((acc, segment) => {
    const idx = segment.indexOf('=');
    if (idx <= 0) return acc;
    acc[segment.slice(0, idx).trim()] = decodeURIComponent(segment.slice(idx + 1).trim());
    return acc;
  }, {});
}

async function bootstrap() {
  const isDev = process.env.NODE_ENV !== 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    rawBody: true,
  });

  // Middleware cookies
  app.use((req: any, res: any, next: () => void) => {
    req.cookies = parseCookies(req.headers?.cookie);
    next();
  });

  // Helmet (sécurité)
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Désactivé pour éviter de bloquer le frontend sur l'IP
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // 👇 CORS : on lit CORS_ORIGIN depuis le .env
  const corsOrigin = process.env.CORS_ORIGIN || (isDev ? 'http://localhost:3000' : '*');
  app.enableCors({
    origin: corsOrigin.split(','),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true, // Autorise les cookies
  });

  // Trust proxy (pour Nginx)
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3001;
  const server = await app.listen(port);
  server.setTimeout(600000);

  console.log(`🚀 Serveur démarré sur le port ${port}`);
  console.log(`✅ CORS autorisé pour: ${corsOrigin}`);
}
bootstrap();