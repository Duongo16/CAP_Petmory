import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { Post, PostSchema } from './schemas/post.schema';
import { Comment, CommentSchema } from './schemas/comment.schema';
import {
  Follow,
  FollowSchema,
  PostLike,
  PostLikeSchema,
  SavedPost,
  SavedPostSchema,
} from './schemas/reaction.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Pet, PetSchema } from '../pets/schemas/pet.schema';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: PostLike.name, schema: PostLikeSchema },
      { name: SavedPost.name, schema: SavedPostSchema },
      { name: Follow.name, schema: FollowSchema },
      { name: User.name, schema: UserSchema },
      { name: Pet.name, schema: PetSchema },
    ]),
    MulterModule.register({ limits: { fileSize: 12 * 1024 * 1024 } }),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
