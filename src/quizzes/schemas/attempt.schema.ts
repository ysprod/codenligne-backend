import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AttemptDocument = Attempt & Document;

export class QuestionSnapshot {
  questionId!: string;
  statement!: string;
  type!: 'SINGLE' | 'MULTIPLE';
  options!: string[];
  correctOptionIndex?: number;
  correctOptionIndexes?: number[];
  explanation?: string;
}

export class AttemptAnswer {
  questionId!: string;
  // 👇 On stocke un tableau pour gérer les deux types (1 seul ou plusieurs)
  selectedOptionIndexes!: number[];
}

@Schema({ timestamps: true })
export class Attempt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Quiz', required: true })
  quizId!: Types.ObjectId;

  @Prop({ required: true })
  mode!: string;

  @Prop({ required: true, default: 'IN_PROGRESS' })
  status!: string;

  @Prop({ type: [Object], required: true })
  drawSnapshot!: QuestionSnapshot[];

  @Prop({ type: [Object], default: [] })
  answers!: AttemptAnswer[];

  @Prop({ type: Number, default: 0 })
  score20!: number;

  @Prop({ type: Boolean, default: false })
  passed!: boolean;

  @Prop({ type: Number, required: true })
  passThreshold!: number;

  @Prop({ type: Date })
  startedAt!: Date;

   // 👇 Date d'échéance stockée en base
  @Prop({ type: Date })
  expiresAt?: Date;

 

  @Prop({ type: Date })
  finalizedAt?: Date;
}

export const AttemptSchema = SchemaFactory.createForClass(Attempt);