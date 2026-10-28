import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SiteMetricsDocument = SiteMetrics & Document;

@Schema({ collection: 'site_metrics' })
export class SiteMetrics {
  @Prop({ default: 0 })
  visits: number;
}

export const SiteMetricsSchema = SchemaFactory.createForClass(SiteMetrics);