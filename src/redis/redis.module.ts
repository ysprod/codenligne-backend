import { Global, Module } from '@nestjs/common';
import { RedisClientModule } from './redis-client.module';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [RedisClientModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
