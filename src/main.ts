import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

function parseCookies(rawCookieHeader: string | undefined): Record<string, string> {
  if (!rawCookieHeader) {
    return {};
  }

  return rawCookieHeader.split(';').reduce<Record<string, string>>((accumulator, segment) => {
    const separatorIndex = segment.indexOf('=');
    if (separatorIndex <= 0) {
      return accumulator;
    }

    const key = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    accumulator[key] = decodeURIComponent(value);
    return accumulator;
  }, {});
}

async function bootstrap() {
  const isDev = process.env.NODE_ENV !== 'production';

  // Debug env uniquement en dev — évite de polluer les logs en prod.
  if (isDev) {
    console.log('========== ENV DEBUG ==========');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('BASE_URL:', process.env.BASE_URL);
    console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('PORT:', process.env.PORT);
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'DEFINED' : 'UNDEFINED');
    console.log('REDIS_HOST:', process.env.REDIS_HOST);
    console.log('REDIS_PORT:', process.env.REDIS_PORT);
    console.log('CWD:', process.cwd());
    console.log('================================');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    rawBody: true,
  });

  // Sert les fichiers uploadés (illustrations, couvertures, photos) sur /uploads.
  // En Docker, UPLOAD_DIR = /app/uploads (volume monté et persistant).
  // Le préfixe global /api/v1 ne s'applique PAS aux assets statiques → URL = /uploads/**.
  app.useStaticAssets(process.env.UPLOAD_DIR || './uploads', { prefix: '/uploads' });

  // 🔥 Middleware cookies + log des requêtes API en temps réel (prod incluse).
  app.use((req: any, res: any, next: () => void) => {
    req.cookies = parseCookies(req.headers?.cookie);

    // Log concis (méthode, url, statut, durée). On ignore le healthcheck
    // (GET /api/v1) pour ne pas noyer les logs toutes les 10 s. Sans query
    // string : des jetons y transitent (?token= du téléchargement de livre,
    // de la vérification de paiement) et finiraient en clair dans les logs.
    const url = (req.originalUrl || req.url || '').split('?')[0];
    const isHealthcheck = req.method === 'GET' && (url === '/api/v1' || url === '/api/v1/');
    if (!isHealthcheck) {
      const start = Date.now();
      res.on('finish', () => {
        console.log(`[HTTP] ${req.method} ${url} → ${res.statusCode} (${Date.now() - start}ms)`);
      });
    }

    next();
  });

  // 🔥 Helmet pour la sécurité (avec configuration adaptée).
  // connectSrc : autorise le front en dev (localhost) et en prod (monetoile.org),
  // + WebSocket en dev.
  const connectSrc = [
    "'self'",
    'https://monetoile.org',
    'https://www.monetoile.org',
    ...(isDev ? ['http://localhost:3000', 'ws://localhost:3000', 'http://localhost:3001', 'ws://localhost:3001'] : []),
  ];

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc,
        fontSrc: ["'self'", 'https:', 'data:'],
      },
    },
  }));

  // 🔥 Configuration des limites de taille (remplace require('express')).
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // 🔥 Validation globale.
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    forbidUnknownValues: false,
    validateCustomDecorators: true,
    whitelist: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // 🔥 Configuration CORS complète — avec déduplication (Set).
  const baseUrl = process.env.BASE_URL || 'https://monetoile.org';

  const origins = new Set<string>([
    baseUrl,
    baseUrl.replace('https://', 'https://www.'),
  ]);

  // Origine publique du frontend (accès par domaine OU par IP:port).
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    origins.add(frontendUrl);
    origins.add(frontendUrl.replace('https://', 'https://www.'));
  }

  if (isDev) {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:3001');
  }

  const allowedOrigins = Array.from(origins);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Permettre les requêtes sans origin (comme les apps mobiles ou postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (
        isDev &&
        (origin?.startsWith('http://localhost') || origin?.startsWith('http://127.0.0.1'))
      ) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Requested-With',
      'Cache-Control',
      'Pragma',
      'Expires',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Derrière le reverse proxy (nginx) : req.ip = vrai client (X-Forwarded-For),
  // sinon le throttler voit 127.0.0.1 → rate-limit GLOBAL au lieu de par-IP.
  app.set('trust proxy', 1);

  // 🔥 Préfixe global pour toutes les routes.
  app.setGlobalPrefix('api/v1');

  // 🔥 Démarrer le serveur.
  const port = process.env.PORT || 3001;
  const server = await app.listen(port);
  server.setTimeout(600000); // 10 minutes

  console.log(`\n🚀 Serveur démarré sur ${baseUrl}/api/v1`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Port: ${port}`);
  console.log(`✅ CORS autorisé pour: ${allowedOrigins.join(', ')}`);

  // 🔥 Gestion des erreurs non capturées.
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // État du process indéterminé après une exception non capturée : on s'arrête
  // et Docker (restart: always + healthcheck) relance un process sain.
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });
}

bootstrap();