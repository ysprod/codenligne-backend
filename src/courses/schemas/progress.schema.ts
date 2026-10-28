import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProgressDocument = Progress & Document;

@Schema({ timestamps: true })
export class Progress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lesson', required: true })
  lessonId!: Types.ObjectId;

  @Prop({ type: String, enum: ['manual', 'auto'], default: 'manual' })
  completedBy!: 'manual' | 'auto';

  @Prop({ type: Date, default: Date.now })
  completedAt!: Date;
}

export const ProgressSchema = SchemaFactory.createForClass(Progress);

// Un utilisateur ne peut terminer une leçon qu'une seule fois
ProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });