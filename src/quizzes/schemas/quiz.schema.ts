import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ContentStatus } from '../../common/enums/content-status.enum';

export type QuizDocument = Quiz & Document;

@Schema({ timestamps: true })
export class Quiz {
  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: ['TRAINING', 'EVALUATION'], default: 'TRAINING' })
  mode!: string;

  @Prop({ required: true, default: 20 })
  passThreshold!: number;

  @Prop({ type: Number })
  durationSec?: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Question' }] })
  questionIds!: Types.ObjectId[];

  @Prop({ type: String, enum: ContentStatus, default: ContentStatus.PUBLISHED })
  status!: ContentStatus;
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);