import { Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { SiteMetricsService } from './site-metrics.service';

@Public()
@Controller('metrics')
export class SiteMetricsController {
  constructor(private readonly metricsService: SiteMetricsService) {}

  // Compteur public : limité par IP pour qu'il ne se gonfle pas en boucle.
  @Post('visit')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async incrementVisits() {
    const visits = await this.metricsService.incrementVisits();
    return { visits };
  }

  @Get('visits')
  async getVisits() {
    const visits = await this.metricsService.getVisits();
    return { visits };
  }
}
