import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserGradeProgressDocument = UserGradeProgress & Document;

@Schema({ timestamps: true })
export class UserGradeProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GradeConfig', required: true })
  gradeId: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  consultationChoicesClicked: number;

  @Prop({ type: [String], default: [] })
  choiceIds: string[]; // Liste des choiceId cliqués pour ce grade

  @Prop({ type: Number, default: 0 })
  rituelsCompleted: number;

  @Prop({ type: Number, default: 0 })
  purchases: number;

  @Prop({ type: Date, required: false })
  gradeEntryDate: Date;

  @Prop({ type: Date, required: false })
  gradeExitDate: Date;

  @Prop({ type: String, required: false })
  nextGrade: string;

  @Prop({ type: String, required: false })
  notes: string;

  @Prop({ type: Boolean, default: false })
  completed: boolean; // Indique si le progress est achevé
}

export const UserGradeProgressSchema = SchemaFactory.createForClass(UserGradeProgress);
