import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ContentStatus } from '../../common/enums/content-status.enum';

export type ChapterDocument = Chapter & Document;

@Schema({ timestamps: true })
export class Chapter {
  @Prop({ type: Types.ObjectId, ref: 'Theme', required: true })
  themeId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop()
  description?: string;

  @Prop({ default: 1 })
  order!: number;

  @Prop({ type: String, enum: ContentStatus, default: ContentStatus.PUBLISHED })
  status!: ContentStatus;
}

export const ChapterSchema = SchemaFactory.createForClass(Chapter);