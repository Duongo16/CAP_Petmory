import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostLikeDocument = HydratedDocument<PostLike>;
export type SavedPostDocument = HydratedDocument<SavedPost>;
export type FollowDocument = HydratedDocument<Follow>;

/** One heart on a post. */
@Schema({ timestamps: true, collection: 'community_likes' })
export class PostLike {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  post!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;
}

export const PostLikeSchema = SchemaFactory.createForClass(PostLike);
// One heart per person per post, enforced by the database rather than by a
// check in the service, so a double click cannot count twice.
PostLikeSchema.index({ post: 1, owner: 1 }, { unique: true });

/** A post someone kept for later, shown on the "Đã lưu" tab. */
@Schema({ timestamps: true, collection: 'community_saved' })
export class SavedPost {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true, index: true })
  post!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;
}

export const SavedPostSchema = SchemaFactory.createForClass(SavedPost);
SavedPostSchema.index({ post: 1, owner: 1 }, { unique: true });

/** One person following another. */
@Schema({ timestamps: true, collection: 'community_follows' })
export class Follow {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  follower!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  following!: Types.ObjectId;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);
FollowSchema.index({ follower: 1, following: 1 }, { unique: true });
