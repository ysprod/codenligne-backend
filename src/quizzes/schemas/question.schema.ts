import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ContentStatus } from '../../common/enums/content-status.enum';

export type QuestionDocument = Question & Document;

@Schema({ timestamps: true })
export class Question {
  @Prop({ required: true })
  statement!: string;

  @Prop({ required: true, enum: ['SINGLE', 'MULTIPLE'], default: 'SINGLE' })
  type!: 'SINGLE' | 'MULTIPLE';

  @Prop({ type: [String], required: true })
  options!: string[];

  @Prop({ type: Number })
  correctOptionIndex?: number;

  @Prop({ type: [Number], default: [] })
  correctOptionIndexes!: number[];

  @Prop({ required: true })
  explanation!: string; // Obligatoire (CDC §7)

  // 👇 Nouveaux champs CDC §7
  @Prop({ type: Types.ObjectId, ref: 'Theme' })
  themeId?: Types.ObjectId;

  @Prop({ required: true, enum: ['EASY', 'MEDIUM', 'HARD'], default: 'MEDIUM' })
  difficulty!: 'EASY' | 'MEDIUM' | 'HARD';

  @Prop()
  illustration?: string; // URL facultative

  @Prop()
  pedagogicalRef?: string; // Source

  @Prop({ type: String, enum: ContentStatus, default: ContentStatus.PUBLISHED })
  status!: ContentStatus;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);