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

  // Mode : 'TRAINING' (entraînement) ou 'EVALUATION' (évaluation)
  @Prop({ required: true, enum: ['TRAINING', 'EVALUATION'], default: 'TRAINING' })
  mode!: string;

   // 👇 Durée en secondes (facultative)
  @Prop({ type: Number })
  durationSec?: number;

  @Prop({ required: true, default: 20 }) // Note sur 20
  passThreshold!: number;

  // Liste des questions associées
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Question' }] })
  questionIds!: Types.ObjectId[];

  @Prop({ type: String, enum: ContentStatus, default: ContentStatus.PUBLISHED })
  status!: ContentStatus;
}

export const QuizSchema = SchemaFactory.createForClass(Quiz);