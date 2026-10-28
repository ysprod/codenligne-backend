import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ConsultationType } from '../../common/enums/consultation-status.enum';

export type ServiceDocument = Service & Document;

@Schema({ timestamps: true })
export class Service {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  slug: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: null })
  longDescription: string;

  @Prop({ type: String, enum: ConsultationType, required: true })
  type: ConsultationType;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: 0 })
  discountPrice: number;

  @Prop({ default: 60 })
  duration: number; // Durée en minutes

  @Prop({ default: null })
  imageUrl: string;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  totalOrders: number;

  @Prop({ type: Number, min: 0, max: 5, default: 0 })
  rating: number;

  @Prop({ default: 0 })
  reviewsCount: number;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

ServiceSchema.index({ type: 1, isActive: 1 });
ServiceSchema.index({ slug: 1 });
