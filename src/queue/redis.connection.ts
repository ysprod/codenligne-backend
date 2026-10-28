import { ConfigService } from '@nestjs/config';
import { ConnectionOptions } from 'bullmq';

export function getRedisConnection(configService: ConfigService): ConnectionOptions {
  return {
    host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
    port: configService.get<number>('REDIS_PORT', 6379),
    username: configService.get<string>('REDIS_USERNAME') || undefined,
    password: configService.get<string>('REDIS_PASSWORD') || undefined,
    db: configService.get<number>('REDIS_DB', 0),
    // BullMQ exige maxRetriesPerRequest=null sur les connexions Worker/QueueEvents.
    maxRetriesPerRequest: null,
    // Pas de commande INFO au ready : évite les erreurs en mode subscriber
    // et accélère légèrement le boot.
    enableReadyCheck: false,
    // Reconnexion avec backoff exponentiel plafonné, au lieu d'abandonner
    // définitivement à la première micro-coupure Redis.
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
  };
}