import { Controller, Post } from '@nestjs/common';
import { SiteMetricsService } from './site-metrics.service';

@Controller('stats')
export class StatsController {
  constructor(
    private readonly metricsService: SiteMetricsService,
  ) {}

  @Post()
  async getStats() {
     const visits = await this.metricsService.getVisits();
    return { subscribers:   0, visits };
  }
}