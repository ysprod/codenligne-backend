import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConsultationDocument = Consultation & Document;

@Schema({ timestamps: true })
export class Consultation {
  @Prop({ required: true })
  nom: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  service: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Offrande', default: [] })
  offrandes: Types.ObjectId[];
}

export const ConsultationSchema = SchemaFactory.createForClass(Consultation);
