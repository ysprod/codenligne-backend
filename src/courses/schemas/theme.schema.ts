import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ContentStatus } from 'common/enums/content-status.enum';
import { Document } from 'mongoose';
 
export type ThemeDocument = Theme & Document;

@Schema({ timestamps: true })
export class Theme {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop()
  description?: string;

  @Prop({ default: 1 })
  order!: number;

  @Prop({ type: String, enum: ContentStatus, default: ContentStatus.DRAFT })
  status!: ContentStatus;
}

export const ThemeSchema = SchemaFactory.createForClass(Theme);