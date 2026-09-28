import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

/** One reply under a post. */
@Schema({ timestamps: true, collection: 'community_comments' })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  post!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  author!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  content!: string;

  /** Soft delete, per the rule that business data is never hard deleted. */
  @Prop({ default: false, index: true })
  isHidden!: boolean;

  @Prop({ type: Date, default: null })
  hiddenAt!: Date | null;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ post: 1, isHidden: 1, createdAt: 1 });
