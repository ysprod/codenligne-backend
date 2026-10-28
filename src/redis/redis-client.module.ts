import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule], // 👈 Important pour injecter ConfigService
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const redis = new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get<string>('REDIS_PORT', '6379'), 10),
          // 👇 On récupère le mot de passe via ConfigService
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: parseInt(configService.get<string>('REDIS_DB', '0'), 10),
          retryStrategy: (times) => Math.min(times * 50, 2000),
          maxRetriesPerRequest: 3,
        });

        redis.on('connect', () => {
          console.log('✅ Redis connected successfully');
        });

        redis.on('error', (err) => {
          console.error('❌ Redis error:', err.message);
        });

        return redis;
      },
      inject: [ConfigService], // 👈 Injection de ConfigService
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisClientModule {}