import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// ─── Modules CODENLIGNE ─────────────────────────────────────────────────────
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AccessModule } from './access/access.module';
import { CoursesModule } from './courses/courses.module';
import { RedisModule } from './redis/redis.module';

// ─── Guards Globaux ─────────────────────────────────────────────────────────
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { QuizzesModule } from 'quizzes/quizzes.module';
import { AuditModule } from 'audit/audit.module';
import { UploadsModule } from 'uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV ?? 'development'}.local`,
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        '.env.local',
        '.env',
      ],
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        retryAttempts: 3,
        retryDelay: 1000,
      }),
      inject: [ConfigService],
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL', 60),
            limit: configService.get<number>('THROTTLE_LIMIT', 10),
          },
        ],
      }),
      inject: [ConfigService],
    }),

    // ─── Modules métier CODENLIGNE ──────────────────────────────────────────
    RedisModule,   // Pour les sessions (refresh tokens)
    AuthModule,    // Login / Register
    UsersModule,   // Gestion des apprenants et admins
    AccessModule,  // Gestion des accès (activation, blocage, etc.)
    CoursesModule, // Thèmes, Chapitres, Leçons
    QuizzesModule, // Quizz
    AuditModule,    // Audit
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Ordre significatif : throttle d'abord, puis authentification.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule { }