import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OffrandeDocument = Offrande & Document;

@Schema({ timestamps: true })
export class Offrande {
  @Prop({ required: true })
  nom: string;

  @Prop({ required: true, min: 0 })
  prix: number;

  @Prop()
  description?: string;
}

export const OffrandeSchema = SchemaFactory.createForClass(Offrande);
