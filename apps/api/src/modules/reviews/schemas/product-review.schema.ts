import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductReviewDocument = HydratedDocument<ProductReview>;

/**
 * A customer's rating of a product type.
 *
 * A review is only accepted from someone whose order for that product has been
 * delivered, and the order it belongs to is recorded, so a rating can always be
 * traced back to a real purchase.
 */
@Schema({ timestamps: true, collection: 'product_reviews' })
export class ProductReview {
  @Prop({ required: true, uppercase: true, trim: true, index: true })
  productTypeCode!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  /** The delivered order that entitles this customer to rate the product. */
  @Prop({ required: true, uppercase: true, trim: true })
  orderCode!: string;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ trim: true, default: '', maxlength: 1000 })
  comment!: string;

  /** Soft delete, per the rule that business data is never hard deleted. */
  @Prop({ default: false, index: true })
  isHidden!: boolean;

  @Prop({ type: Date, default: null })
  hiddenAt!: Date | null;
}

export const ProductReviewSchema = SchemaFactory.createForClass(ProductReview);

// One rating per customer per order line, enforced by the database rather than
// by a check in the service, so two parallel requests cannot both get through.
ProductReviewSchema.index({ owner: 1, productTypeCode: 1, orderCode: 1 }, { unique: true });
