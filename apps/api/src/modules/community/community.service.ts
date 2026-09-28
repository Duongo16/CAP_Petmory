import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Post, PostDocument, PostTopic } from './schemas/post.schema';
import { Comment, CommentDocument } from './schemas/comment.schema';
import {
  Follow,
  FollowDocument,
  PostLike,
  PostLikeDocument,
  SavedPost,
  SavedPostDocument,
} from './schemas/reaction.schema';
import { FeedQueryDto, WriteCommentDto, WritePostDto } from './dto/community.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Pet, PetDocument } from '../pets/schemas/pet.schema';
import { MSG } from '../../common/constants/messages';

/** Mongo raises this code when a unique index rejects a duplicate row. */
const DUPLICATE_KEY = 11000;
const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_MAX = 30;
const PHOTO_MAX = 4;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const NOT_AN_IMAGE = 'Chi nhan anh JPG, PNG hoac WEBP';

/** The author details every card and comment needs. */
export interface AuthorView {
  id: string;
  fullName: string;
  initial: string;
}

export interface PostView {
  id: string;
  topic: PostTopic;
  title: string;
  content: string;
  photos: string[];
  tags: string[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: Date;
  author: AuthorView;
  likedByMe: boolean;
  savedByMe: boolean;
  mine: boolean;
}

/**
 * Escapes characters that carry special meaning inside a search expression.
 * A keyword typed by a user must never turn itself into a pattern.
 */
function escape(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class CommunityService {
  private readonly dir: string;

  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Comment.name) private readonly commentModel: Model<CommentDocument>,
    @InjectModel(PostLike.name) private readonly likeModel: Model<PostLikeDocument>,
    @InjectModel(SavedPost.name) private readonly savedModel: Model<SavedPostDocument>,
    @InjectModel(Follow.name) private readonly followModel: Model<FollowDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Pet.name) private readonly petModel: Model<PetDocument>,
    config: ConfigService,
  ) {
    this.dir = path.resolve(config.get<string>('upload.dir') ?? './uploads', 'community');
  }

  // --- Feed ---

  async feed(viewer: string | null, query: FeedQueryDto) {
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, query.pageSize ?? PAGE_SIZE_DEFAULT));
    const page = Math.max(1, query.page ?? 1);
    const where = await this.feedFilter(viewer, query);

    const [rows, total] = await Promise.all([
      this.postModel
        .find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.postModel.countDocuments(where).exec(),
    ]);

    return {
      rows: await this.decorate(rows, viewer),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Builds the query for the feed, one condition per filter the screen offers. */
  private async feedFilter(viewer: string | null, query: FeedQueryDto) {
    const where: Record<string, unknown> = { isHidden: false };

    if (query.topic) {
      where.topic = query.topic;
    }

    const keyword = query.keyword?.trim();
    if (keyword) {
      const pattern = new RegExp(escape(keyword), 'i');
      where.$or = [{ title: pattern }, { content: pattern }, { tags: pattern }];
    }

    if (viewer && query.scope && query.scope !== 'ALL') {
      where._id = { $in: await this.scopeIds(viewer, query.scope) };
    }

    return where;
  }

  /** The post ids a narrowed feed is allowed to show. */
  private async scopeIds(viewer: string, scope: 'FOLLOWING' | 'SAVED' | 'LIKED') {
    const viewerId = new Types.ObjectId(viewer);
    if (scope === 'FOLLOWING') {
      const following = await this.followModel.find({ follower: viewerId }).select('following').exec();
      const authors = following.map((f) => f.following);
      const posts = await this.postModel.find({ author: { $in: authors } }).select('_id').exec();
      return posts.map((p) => p._id);
    }
    const rows =
      scope === 'SAVED'
        ? await this.savedModel.find({ owner: viewerId }).select('post').exec()
        : await this.likeModel.find({ owner: viewerId }).select('post').exec();
    return rows.map((r) => r.post);
  }

  /** Attaches the author and the viewer's own reactions, in one query each. */
  private async decorate(rows: PostDocument[], viewer: string | null): Promise<PostView[]> {
    if (rows.length === 0) {
      return [];
    }
    const authorIds = [...new Set(rows.map((r) => r.author.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: authorIds.map((id) => new Types.ObjectId(id)) } })
      .select('fullName')
      .exec();
    const byId = new Map(users.map((u) => [u._id.toString(), u.fullName]));

    const postIds = rows.map((r) => r._id);
    const [liked, saved] = viewer
      ? await Promise.all([
          this.likeModel
            .find({ owner: new Types.ObjectId(viewer), post: { $in: postIds } })
            .select('post')
            .exec(),
          this.savedModel
            .find({ owner: new Types.ObjectId(viewer), post: { $in: postIds } })
            .select('post')
            .exec(),
        ])
      : [[], []];
    const likedSet = new Set(liked.map((r) => r.post.toString()));
    const savedSet = new Set(saved.map((r) => r.post.toString()));

    return rows.map((r) => this.toView(r, byId, likedSet, savedSet, viewer));
  }

  private toView(
    row: PostDocument,
    nameById: Map<string, string>,
    likedSet: Set<string>,
    savedSet: Set<string>,
    viewer: string | null,
  ): PostView {
    const authorId = row.author.toString();
    const fullName = nameById.get(authorId) ?? '';
    return {
      id: row._id.toString(),
      topic: row.topic,
      title: row.title,
      content: row.content,
      photos: row.photos,
      tags: row.tags,
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      viewCount: row.viewCount,
      createdAt: (row as unknown as { createdAt: Date }).createdAt,
      author: { id: authorId, fullName, initial: fullName.trim().charAt(0).toUpperCase() || '?' },
      likedByMe: likedSet.has(row._id.toString()),
      savedByMe: savedSet.has(row._id.toString()),
      mine: viewer === authorId,
    };
  }

  /** How many posts sit under each topic, for the discover screen. */
  async topicCounts(): Promise<Record<string, number>> {
    const group = await this.postModel
      .aggregate<{ _id: PostTopic; count: number }>([
        { $match: { isHidden: false } },
        { $group: { _id: '$topic', count: { $sum: 1 } } },
      ])
      .exec();
    const out: Record<string, number> = {};
    for (const topic of Object.values(PostTopic)) {
      out[topic] = 0;
    }
    for (const row of group) {
      out[row._id] = row.count;
    }
    return out;
  }

  // --- One post ---

  async detail(id: string, viewer: string | null) {
    const post = await this.postModel
      .findOneAndUpdate({ _id: this.toId(id), isHidden: false }, { $inc: { viewCount: 1 } }, { new: true })
      .exec();
    if (!post) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const [view] = await this.decorate([post], viewer);

    const related = await this.postModel
      .find({ topic: post.topic, isHidden: false, _id: { $ne: post._id } })
      .sort({ createdAt: -1 })
      .limit(3)
      .exec();

    const byAuthor = await this.postModel
      .countDocuments({ author: post.author, isHidden: false })
      .exec();
    const followers = await this.followModel.countDocuments({ following: post.author }).exec();
    const followedByMe = viewer
      ? (await this.followModel
          .countDocuments({ follower: new Types.ObjectId(viewer), following: post.author })
          .exec()) > 0
      : false;

    return {
      post: view,
      related: await this.decorate(related, viewer),
      author: { postCount: byAuthor, followerCount: followers, followedByMe },
    };
  }

  async create(author: string, dto: WritePostDto): Promise<PostDocument> {
    const pet = await this.ownPet(author, dto.petId);
    return this.postModel.create({
      author: new Types.ObjectId(author),
      topic: dto.topic,
      title: dto.title,
      content: dto.content,
      tags: this.cleanTags(dto.tags),
      pet,
      photos: [],
    });
  }

  async edit(id: string, author: string, dto: WritePostDto): Promise<PostDocument> {
    const post = await this.findOwned(id, author);
    const pet = await this.ownPet(author, dto.petId);
    post.topic = dto.topic;
    post.title = dto.title;
    post.content = dto.content;
    post.tags = this.cleanTags(dto.tags);
    post.pet = pet;
    await post.save();
    return post;
  }

  /** Soft delete. The author may take their own post down. */
  async hide(id: string, author: string | null): Promise<PostDocument> {
    const where: Record<string, unknown> = { _id: this.toId(id) };
    if (author) {
      where.author = new Types.ObjectId(author);
    }
    const post = await this.postModel
      .findOneAndUpdate(where, { $set: { isHidden: true, hiddenAt: new Date() } }, { new: true })
      .exec();
    if (!post) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return post;
  }

  /**
   * Checks ownership on the post itself, not just the caller's role.
   * A non-owner gets not-found, so the post's existence is not revealed.
   */
  private async findOwned(id: string, author: string): Promise<PostDocument> {
    const post = await this.postModel
      .findOne({ _id: this.toId(id), author: new Types.ObjectId(author), isHidden: false })
      .exec();
    if (!post) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return post;
  }

  // --- Photos on a post ---

  async addPhoto(id: string, author: string, file?: Express.Multer.File): Promise<PostDocument> {
    if (!file) {
      throw new BadRequestException('Chua chon tep anh nao');
    }
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(NOT_AN_IMAGE);
    }
    if (file.size > PHOTO_MAX_BYTES) {
      throw new BadRequestException('Anh vuot qua 10 MB');
    }
    const post = await this.findOwned(id, author);
    if (post.photos.length >= PHOTO_MAX) {
      throw new BadRequestException(`Moi bai viet toi da ${PHOTO_MAX} anh`);
    }
    const fileName = `${randomUUID()}.${file.mimetype === 'image/png' ? 'png' : 'jpg'}`;
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(path.join(this.dir, fileName), file.buffer);
    post.photos.push(fileName);
    await post.save();
    return post;
  }

  /** Reads the bytes of a post photo. The post must be visible. */
  async readPhoto(id: string, fileName: string): Promise<Buffer> {
    const post = await this.postModel.findOne({ _id: this.toId(id), isHidden: false }).exec();
    if (!post || !post.photos.includes(fileName)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return fs.readFile(path.join(this.dir, fileName));
  }

  // --- Comments ---

  async listComment(postId: string) {
    const rows = await this.commentModel
      .find({ post: this.toId(postId), isHidden: false })
      .sort({ createdAt: 1 })
      .exec();
    const authorIds = [...new Set(rows.map((r) => r.author.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: authorIds.map((x) => new Types.ObjectId(x)) } })
      .select('fullName')
      .exec();
    const byId = new Map(users.map((u) => [u._id.toString(), u.fullName]));
    return rows.map((r) => {
      const fullName = byId.get(r.author.toString()) ?? '';
      return {
        id: r._id.toString(),
        content: r.content,
        createdAt: (r as unknown as { createdAt: Date }).createdAt,
        author: {
          id: r.author.toString(),
          fullName,
          initial: fullName.trim().charAt(0).toUpperCase() || '?',
        },
      };
    });
  }

  async comment(postId: string, author: string, dto: WriteCommentDto) {
    const post = await this.postModel.findOne({ _id: this.toId(postId), isHidden: false }).exec();
    if (!post) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const row = await this.commentModel.create({
      post: post._id,
      author: new Types.ObjectId(author),
      content: dto.content,
    });
    await this.postModel.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } }).exec();
    return row;
  }

  async hideComment(id: string, author: string | null) {
    const where: Record<string, unknown> = { _id: this.toId(id), isHidden: false };
    if (author) {
      where.author = new Types.ObjectId(author);
    }
    const row = await this.commentModel
      .findOneAndUpdate(where, { $set: { isHidden: true, hiddenAt: new Date() } }, { new: true })
      .exec();
    if (!row) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    await this.postModel.updateOne({ _id: row.post }, { $inc: { commentCount: -1 } }).exec();
    return row;
  }

  // --- Reactions ---

  /**
   * Turns a heart on or off. The row is inserted first and a duplicate is caught
   * from the database, rather than reading then writing, so two rapid clicks
   * cannot both insert.
   */
  async toggleLike(postId: string, owner: string): Promise<{ liked: boolean; likeCount: number }> {
    const post = await this.postModel.findOne({ _id: this.toId(postId), isHidden: false }).exec();
    if (!post) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const ownerId = new Types.ObjectId(owner);
    let liked: boolean;
    try {
      await this.likeModel.create({ post: post._id, owner: ownerId });
      liked = true;
    } catch (error) {
      if ((error as { code?: number }).code !== DUPLICATE_KEY) {
        throw error;
      }
      await this.likeModel.deleteOne({ post: post._id, owner: ownerId }).exec();
      liked = false;
    }
    // The count is recomputed from the rows rather than nudged up and down, so
    // it cannot drift away from the truth.
    const likeCount = await this.likeModel.countDocuments({ post: post._id }).exec();
    await this.postModel.updateOne({ _id: post._id }, { $set: { likeCount } }).exec();
    return { liked, likeCount };
  }

  async toggleSave(postId: string, owner: string): Promise<{ saved: boolean }> {
    const post = await this.postModel.findOne({ _id: this.toId(postId), isHidden: false }).exec();
    if (!post) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const ownerId = new Types.ObjectId(owner);
    try {
      await this.savedModel.create({ post: post._id, owner: ownerId });
      return { saved: true };
    } catch (error) {
      if ((error as { code?: number }).code !== DUPLICATE_KEY) {
        throw error;
      }
      await this.savedModel.deleteOne({ post: post._id, owner: ownerId }).exec();
      return { saved: false };
    }
  }

  async toggleFollow(target: string, follower: string): Promise<{ following: boolean }> {
    if (target === follower) {
      throw new ForbiddenException('Khong the tu theo doi chinh minh');
    }
    const user = await this.userModel.findById(this.toId(target)).select('_id').exec();
    if (!user) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const followerId = new Types.ObjectId(follower);
    try {
      await this.followModel.create({ follower: followerId, following: user._id });
      return { following: true };
    } catch (error) {
      if ((error as { code?: number }).code !== DUPLICATE_KEY) {
        throw error;
      }
      await this.followModel.deleteOne({ follower: followerId, following: user._id }).exec();
      return { following: false };
    }
  }

  // --- Public profile ---

  async profile(userId: string, viewer: string | null) {
    const id = this.toId(userId);
    const user = await this.userModel.findById(id).select('fullName email').exec();
    if (!user) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    const [postCount, followerCount, followingCount, pets] = await Promise.all([
      this.postModel.countDocuments({ author: id, isHidden: false }).exec(),
      this.followModel.countDocuments({ following: id }).exec(),
      this.followModel.countDocuments({ follower: id }).exec(),
      this.petModel.find({ owner: id, isHidden: false }).select('name kind breed').limit(6).exec(),
    ]);
    const followedByMe = viewer
      ? (await this.followModel
          .countDocuments({ follower: new Types.ObjectId(viewer), following: id })
          .exec()) > 0
      : false;

    const fullName = user.fullName;
    return {
      id: user._id.toString(),
      fullName,
      initial: fullName.trim().charAt(0).toUpperCase() || '?',
      handle: `@${user.email.split('@')[0]}`,
      postCount,
      followerCount,
      followingCount,
      followedByMe,
      mine: viewer === user._id.toString(),
      pets: pets.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        kind: p.kind,
        breed: p.breed,
      })),
    };
  }

  /** The posts written by one person, for their profile page. */
  async postsOf(userId: string, viewer: string | null) {
    const rows = await this.postModel
      .find({ author: this.toId(userId), isHidden: false })
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE_MAX)
      .exec();
    return this.decorate(rows, viewer);
  }

  // --- Helpers ---

  private toId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return new Types.ObjectId(value);
  }

  /** A post may only point at a pet profile the author owns. */
  private async ownPet(owner: string, petId?: string): Promise<Types.ObjectId | null> {
    if (!petId) {
      return null;
    }
    const pet = await this.petModel
      .findOne({ _id: this.toId(petId), owner: new Types.ObjectId(owner), isHidden: false })
      .select('_id')
      .exec();
    if (!pet) {
      throw new NotFoundException(MSG.NOT_FOUND);
    }
    return pet._id;
  }

  private cleanTags(tags?: string[]): string[] {
    return [...new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))];
  }
}
