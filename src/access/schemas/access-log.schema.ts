import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AccessAction } from '../../common/enums/access-action.enum';
import { AccessStatus } from '../../common/enums/access-status.enum';

export type AccessLogDocument = AccessLog & Document;

@Schema({ timestamps: true })
export class AccessLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: AccessAction, required: true })
  action!: AccessAction;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  actorId!: Types.ObjectId;

  @Prop({ type: String, required: false })
  reason?: string;

  @Prop({ type: String, enum: AccessStatus, required: true })
  previousStatus!: AccessStatus;

  @Prop({ type: String, enum: AccessStatus, required: true })
  newStatus!: AccessStatus;

  @Prop({ type: Date, required: false })
  previousEndsAt?: Date;

  @Prop({ type: Date, required: false })
  newEndsAt?: Date;
}

export const AccessLogSchema = SchemaFactory.createForClass(AccessLog);

// Index pour retrouver rapidement l'historique d'un utilisateur
AccessLogSchema.index({ userId: 1, createdAt: -1 });