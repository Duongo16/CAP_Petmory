export type PostTopic = 'MOMENT' | 'MEMORIAL' | 'EXPERIENCE' | 'PRODUCT' | 'TRADE' | 'OTHER';

export type FeedScope = 'ALL' | 'FOLLOWING' | 'SAVED' | 'LIKED';

export interface PostAuthor {
  id: string;
  fullName: string;
  initial: string;
}

export interface CommunityPost {
  id: string;
  topic: PostTopic;
  title: string;
  content: string;
  /** File names. The bytes come back through a permission-checked path. */
  photos: string[];
  tags: string[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  author: PostAuthor;
  likedByMe: boolean;
  savedByMe: boolean;
  mine: boolean;
}

export interface FeedPage {
  rows: CommunityPost[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
}

export interface PostDetail {
  post: CommunityPost;
  related: CommunityPost[];
  author: { postCount: number; followerCount: number; followedByMe: boolean };
}

export interface CommunityProfile {
  id: string;
  fullName: string;
  initial: string;
  handle: string;
  phone: string | null;
  avatarUrl: string | null;
  postCount: number;
  followerCount: number;
  followingCount: number;
  followedByMe: boolean;
  mine: boolean;
  pets: { id: string; name: string; kind: string; breed: string }[];
}

export interface WritePostInput {
  topic: PostTopic;
  title: string;
  content: string;
  tags?: string[];
  petId?: string;
}
