import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ContentStatus } from '../../common/enums/content-status.enum';

export type QuestionVersionDocument = QuestionVersion & Document;

@Schema({ timestamps: true })
export class QuestionVersion {
  @Prop({ type: Types.ObjectId, ref: 'Question', required: true })
  questionId!: Types.ObjectId;

  @Prop({ required: true })
  versionNumber!: number;

  // Snapshot complet de la question à ce moment-là
  @Prop({ type: Object, required: true })
  snapshot!: Record<string, any>;

  @Prop({ type: String, enum: ContentStatus, default: ContentStatus.ARCHIVED })
  status!: ContentStatus;
}

export const QuestionVersionSchema = SchemaFactory.createForClass(QuestionVersion);