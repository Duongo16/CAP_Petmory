import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favourite, FavouriteDocument } from './schemas/favourite.schema';
import { CatalogService } from '../catalog/catalog.service';

/** Mongo raises this code when a unique index rejects a duplicate row. */
const DUPLICATE_KEY = 11000;

@Injectable()
export class FavouritesService {
  constructor(
    @InjectModel(Favourite.name) private readonly model: Model<FavouriteDocument>,
    private readonly catalog: CatalogService,
  ) {}

  /** The product codes this customer has marked, for painting the hearts in a list. */
  async codesOf(owner: string): Promise<string[]> {
    const rows = await this.model
      .find({ owner: new Types.ObjectId(owner) })
      .select('productTypeCode')
      .exec();
    return rows.map((r) => r.productTypeCode);
  }

  /** The marked products in full, for the favourites tab on the account page. */
  async listOf(owner: string) {
    const codes = await this.codesOf(owner);
    if (codes.length === 0) {
      return [];
    }
    const all = await this.catalog.listProductType(true);
    const rating = await this.catalog.ratingByProduct(codes);
    return all
      .filter((m) => codes.includes(m.code))
      .map((m) => ({ ...m.toObject(), rating: rating.get(m.code) ?? { average: 0, count: 0 } }));
  }

  /**
   * Turns the heart on or off. The row is inserted first and a duplicate is
   * caught from the database, rather than reading then writing, so two rapid
   * clicks cannot both insert.
   */
  async toggle(owner: string, productTypeCode: string): Promise<{ favourite: boolean }> {
    const kind = await this.catalog.detailProductType(productTypeCode);
    const ownerId = new Types.ObjectId(owner);
    try {
      await this.model.create({ owner: ownerId, productTypeCode: kind.code });
      return { favourite: true };
    } catch (error) {
      if ((error as { code?: number }).code !== DUPLICATE_KEY) {
        throw error;
      }
      await this.model.deleteOne({ owner: ownerId, productTypeCode: kind.code }).exec();
      return { favourite: false };
    }
  }
}
