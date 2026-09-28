import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

/** The subject a post belongs to, matching the filter chips above the feed. */
export enum PostTopic {
  MOMENT = 'MOMENT',
  MEMORIAL = 'MEMORIAL',
  EXPERIENCE = 'EXPERIENCE',
  PRODUCT = 'PRODUCT',
  TRADE = 'TRADE',
  OTHER = 'OTHER',
}

/** A post on the community feed. */
@Schema({ timestamps: true, collection: 'community_posts' })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  author!: Types.ObjectId;

  @Prop({ type: String, enum: PostTopic, required: true, index: true })
  topic!: PostTopic;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 5000 })
  content!: string;

  /** Uploaded image file names. The bytes are served through a checked path. */
  @Prop({ type: [String], default: [] })
  photos!: string[];

  /** Free tags the author added, stored lower case so they group together. */
  @Prop({ type: [String], default: [] })
  tags!: string[];

  /** The pet this post is about, when the author picked one of their profiles. */
  @Prop({ type: Types.ObjectId, ref: 'Pet', default: null })
  pet!: Types.ObjectId | null;

  @Prop({ type: Number, default: 0, min: 0 })
  likeCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  commentCount!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  viewCount!: number;

  /** Soft delete, per the rule that business data is never hard deleted. */
  @Prop({ default: false, index: true })
  isHidden!: boolean;

  @Prop({ type: Date, default: null })
  hiddenAt!: Date | null;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ isHidden: 1, createdAt: -1 });
