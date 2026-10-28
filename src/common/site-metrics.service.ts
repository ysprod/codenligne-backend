import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SiteMetrics, SiteMetricsDocument } from './schemas/site-metrics.schema';

@Injectable()
export class SiteMetricsService {
  constructor(@InjectModel(SiteMetrics.name) private metricsModel: Model<SiteMetricsDocument>) {}

  async incrementVisits(): Promise<number> {
    const metrics = await this.metricsModel.findOneAndUpdate(
      {},
      { $inc: { visits: 1 } },
      { new: true, upsert: true },
    );
    return metrics.visits;
  }

  async getVisits(): Promise<number> {
    const metrics = await this.metricsModel.findOne({});
    return metrics?.visits || 0;
  }
}