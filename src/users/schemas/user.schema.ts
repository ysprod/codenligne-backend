import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose'; // 👈 Ajout de Types
import { Role } from '../../common/enums/role.enum';
import { AccessStatus } from '../../common/enums/access-status.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  // 👇 Déclaration explicite de _id pour TypeScript
  _id!: Types.ObjectId;

  // ─── Identité (CDC §3) ─────────────────────────────
  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  username!: string;

  @Prop({ required: true, unique: true, trim: true, index: true })
  phone!: string;

  @Prop({ trim: true, lowercase: true, required: false })
  email?: string;

  @Prop({ required: false, enum: ['male', 'female', 'other'] })
  gender?: string;

  @Prop({ required: true })
  password!: string;

  // ─── Rôles & permissions (CDC §2) ──────────────────
  @Prop({ type: String, enum: Role, default: Role.LEARNER })
  role!: Role;

  @Prop({ type: [String], default: [] })
  customPermissions!: string[];

  // ─── Statut d'accès (CDC §3) ───────────────────────
  @Prop({ type: String, enum: AccessStatus, default: AccessStatus.PENDING, index: true })
  status!: AccessStatus;

  @Prop({ type: Date, required: false })
  accessEndsAt?: Date;

  @Prop({ type: String, required: false })
  blockReason?: string;

  @Prop({ type: String, required: false })
  refusalReason?: string;

  @Prop({ type: Date, required: false })
  activatedAt?: Date;

  @Prop({ type: String, required: false })
  activatedBy?: string;

  @Prop({ type: Date, required: false })
  lastLoginAt?: Date;

  // ─── Verrou optimiste (CDC §6) ─────────────────────
  @Prop({ type: Number, default: 1 })
  version!: number;

  // ─── Mot de passe oublié (CDC §3) ──────────────────
  @Prop({ type: String, required: false })
  resetPasswordToken?: string;

  @Prop({ type: Date, required: false })
  resetPasswordExpires?: Date;

  // ─── Refresh token (Redis reste la source de vérité) ─
  @Prop({ type: String, required: false })
  currentRefreshTokenHash?: string;

  @Prop({ type: Date, required: false })
  currentRefreshTokenIssuedAt?: Date;

  // ─── Préférences ───────────────────────────────────
  @Prop({
    type: {
      language: { type: String, default: 'fr' },
      notifications: { type: Boolean, default: true },
    },
    default: {},
  })
  preferences?: {
    language?: string;
    notifications?: boolean;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);

// Index composé pour la recherche rapide des comptes à expirer
UserSchema.index({ status: 1, accessEndsAt: 1 });

// Index unique sur l'email qui ignore les valeurs vides (null/undefined)
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);