import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ContentStatus } from '../../common/enums/content-status.enum';

export type LessonDocument = Lesson & Document;

@Schema({ timestamps: true })
export class Lesson {
  // 👇 La leçon est maintenant liée à un chapitre
  @Prop({ type: Types.ObjectId, ref: 'Chapter', required: true })
  chapterId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ type: Object, required: true })
  content!: Record<string, any>;

  @Prop({ default: 1 })
  order!: number;

  @Prop({ type: String, enum: ContentStatus, default: ContentStatus.PUBLISHED })
  status!: ContentStatus;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);