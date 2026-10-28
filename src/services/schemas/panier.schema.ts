import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PanierDocument = Panier & Document;

@Schema({ timestamps: true })
export class Panier {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, min: 0 })
  totalDepense: number;
}

@Schema({ timestamps: true })
export class Achat {
  @Prop({ type: Types.ObjectId, ref: 'Panier', required: true })
  panier: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Offrande', required: true })
  offrande: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantite: number;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, min: 0 })
  prixTotal: number;
}

export const PanierSchema = SchemaFactory.createForClass(Panier);
export const AchatSchema = SchemaFactory.createForClass(Achat);
