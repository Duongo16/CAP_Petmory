import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductReview, ProductReviewDocument } from './schemas/product-review.schema';
import { WriteReviewDto } from './dto/review.dto';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { MSG } from '../../common/constants/messages';

const NOT_DELIVERED = 'Chi danh gia duoc sau khi don hang hoan tat';
const NOT_IN_ORDER = 'Don hang nay khong co san pham do';

/** One review with the author's display name, ready for the product page. */
export interface ReviewView {
  id: string;
  rating: number;
  comment: string;
  authorName: string;
  createdAt: Date;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(ProductReview.name) private readonly model: Model<ProductReviewDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Public list for a product page, newest first. Hidden reviews are left out. */
  async listForProduct(productTypeCode: string, limit = 20): Promise<ReviewView[]> {
    const rows = await this.model
      .find({ productTypeCode: productTypeCode.toUpperCase(), isHidden: false })
      .sort({ createdAt: -1 })
      .limit(Math.min(50, Math.max(1, limit)))
      .exec();

    const owners = [...new Set(rows.map((r) => r.owner.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: owners.map((id) => new Types.ObjectId(id)) } })
      .select('fullName')
      .exec();
    const nameById = new Map(users.map((u) => [u._id.toString(), u.fullName]));

    return rows.map((r) => ({
      id: r._id.toString(),
      rating: r.rating,
      comment: r.comment,
      authorName: nameById.get(r.owner.toString()) ?? '',
      createdAt: (r as unknown as { createdAt: Date }).createdAt,
    }));
  }

  /** The products this customer may still rate, taken from their delivered orders. */
  async pendingForCustomer(owner: string): Promise<{ productTypeCode: string; orderCode: string }[]> {
    const ownerId = new Types.ObjectId(owner);
    const delivered = await this.orderModel
      .find({ customer: ownerId, status: OrderStatus.COMPLETED })
      .select('orderCode rows')
      .exec();

    const done = await this.model.find({ owner: ownerId }).select('productTypeCode orderCode').exec();
    const already = new Set(done.map((r) => `${r.orderCode}|${r.productTypeCode}`));

    const out: { productTypeCode: string; orderCode: string }[] = [];
    for (const order of delivered) {
      for (const line of order.rows) {
        const key = `${order.orderCode}|${line.productTypeCode}`;
        if (!already.has(key) && !out.some((x) => x.orderCode === order.orderCode && x.productTypeCode === line.productTypeCode)) {
          out.push({ productTypeCode: line.productTypeCode, orderCode: order.orderCode });
        }
      }
    }
    return out;
  }

  /**
   * Records a rating. The order must belong to the caller, must be delivered,
   * and must actually contain the product being rated.
   */
  async write(owner: string, dto: WriteReviewDto): Promise<ProductReviewDocument> {
    const ownerId = new Types.ObjectId(owner);
    const orderCode = dto.orderCode.toUpperCase();
    const productTypeCode = dto.productTypeCode.toUpperCase();

    const order = await this.orderModel.findOne({ orderCode, customer: ownerId }).exec();
    if (!order) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    if (order.status !== OrderStatus.COMPLETED) {
      throw new ForbiddenException(NOT_DELIVERED);
    }
    if (!order.rows.some((line) => line.productTypeCode === productTypeCode)) {
      throw new BadRequestException(NOT_IN_ORDER);
    }

    // The unique index decides who wins if the same review is sent twice.
    const saved = await this.model
      .findOneAndUpdate(
        { owner: ownerId, productTypeCode, orderCode },
        { $set: { rating: dto.rating, comment: dto.comment ?? '', isHidden: false, hiddenAt: null } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
    return saved;
  }

  /** Soft delete. Used by the customer on their own review and by internal staff. */
  async hide(id: string, owner: string | null): Promise<ProductReviewDocument> {
    const where: Record<string, unknown> = { _id: new Types.ObjectId(id) };
    if (owner) {
      where.owner = new Types.ObjectId(owner);
    }
    const review = await this.model
      .findOneAndUpdate(where, { $set: { isHidden: true, hiddenAt: new Date() } }, { new: true })
      .exec();
    if (!review) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return review;
  }
}
