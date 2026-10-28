import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SiteMetrics, SiteMetricsSchema } from './schemas/site-metrics.schema';
import { SiteMetricsService } from './site-metrics.service';
import { SiteMetricsController } from './site-metrics.controller';
import { StatsController } from './stats.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SiteMetrics.name, schema: SiteMetricsSchema }]),
    UsersModule,
  ],
  providers: [SiteMetricsService],
  controllers: [SiteMetricsController, StatsController],
  exports: [SiteMetricsService],
})
export class SiteMetricsModule {}
