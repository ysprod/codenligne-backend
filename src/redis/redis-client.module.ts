import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0', 10),
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
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisClientModule {}
