import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FavouriteDocument = HydratedDocument<Favourite>;

/** One product a customer has marked with the heart on a product card. */
@Schema({ timestamps: true, collection: 'favourites' })
export class Favourite {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ required: true, uppercase: true, trim: true })
  productTypeCode!: string;
}

export const FavouriteSchema = SchemaFactory.createForClass(Favourite);

// A customer can only mark a product once. The database enforces it, so a
// double click cannot create two rows.
FavouriteSchema.index({ owner: 1, productTypeCode: 1 }, { unique: true });
