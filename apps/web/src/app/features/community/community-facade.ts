import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommunityService } from '../../core/services/community.service';
import {
  CommunityPost,
  FeedScope,
  PostTopic,
  WritePostInput,
} from '../../core/models/community.model';
import { TOPIC_ORDER, topicKey, topicTone } from './community-topics';

/** One card on the feed, carrying everything the view needs already worked out. */
export interface FeedCard {
  raw: CommunityPost;
  topicKey: string;
  topicTone: string;
  photoUrls: string[];
}

/** One filter chip above the feed. */
export interface TopicChip {
  topic: PostTopic | null;
  key: string;
  count: number;
}

const SCOPE_KEY: Record<FeedScope, string> = {
  ALL: 'COMMUNITY.SCOPE.ALL',
  FOLLOWING: 'COMMUNITY.SCOPE.FOLLOWING',
  SAVED: 'COMMUNITY.SCOPE.SAVED',
  LIKED: 'COMMUNITY.SCOPE.LIKED',
};

export const SCOPE_ORDER: FeedScope[] = ['ALL', 'FOLLOWING', 'SAVED', 'LIKED'];

export function scopeKey(scope: FeedScope): string {
  return SCOPE_KEY[scope];
}

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

/**
 * Holds the feed, the filters and every write the community screens make.
 * The components only read signals and issue commands, keeping no state of their own.
 */
@Injectable()
export class CommunityFacade {
  private readonly service = inject(CommunityService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly topic = signal<PostTopic | null>(null);
  readonly scope = signal<FeedScope>('ALL');
  readonly keyword = signal('');
  readonly page = signal(1);
  readonly pageCount = signal(1);
  readonly total = signal(0);

  private readonly posts = signal<CommunityPost[]>([]);
  private readonly counts = signal<Record<string, number>>({});

  /** Each card carries its translation keys, so the view calls no functions. */
  readonly cards = computed<FeedCard[]>(() =>
    this.posts().map((p) => ({
      raw: p,
      topicKey: topicKey(p.topic),
      topicTone: topicTone(p.topic),
      photoUrls: p.photos.map((f) => this.service.photoUrl(p.id, f)),
    })),
  );

  readonly empty = computed(() => this.status() === 'DONE' && this.posts().length === 0);

  /** The filter chips, with "all" first and a count on each topic. */
  readonly chips = computed<TopicChip[]>(() => {
    const counts = this.counts();
    const all: TopicChip = { topic: null, key: 'COMMUNITY.TOPIC.ALL', count: this.totalCount() };
    return [all, ...TOPIC_ORDER.map((t) => ({ topic: t, key: topicKey(t), count: counts[t] ?? 0 }))];
  });

  private totalCount(): number {
    return Object.values(this.counts()).reduce((sum, n) => sum + n, 0);
  }

  load(): void {
    this.status.set('LOADING');
    this.service
      .feed({
        topic: this.topic(),
        keyword: this.keyword(),
        scope: this.scope(),
        page: this.page(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.posts.set(page.rows);
          this.total.set(page.total);
          this.pageCount.set(page.pageCount);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });

    this.service
      .topicCounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.counts.set(c), error: () => undefined });
  }

  /** Clicking the chip already selected clears the filter. */
  chooseTopic(topic: PostTopic | null): void {
    this.topic.set(this.topic() === topic ? null : topic);
    this.page.set(1);
    this.load();
  }

  chooseScope(scope: FeedScope): void {
    this.scope.set(scope);
    this.page.set(1);
    this.load();
  }

  search(keyword: string): void {
    this.keyword.set(keyword);
    this.page.set(1);
    this.load();
  }

  changePage(next: number): void {
    this.page.set(Math.min(Math.max(1, next), this.pageCount()));
    this.load();
  }

  /** Flips the heart and writes the count the server sends back. */
  toggleLike(post: CommunityPost): void {
    this.service
      .toggleLike(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.patch(post.id, { likedByMe: r.liked, likeCount: r.likeCount }),
        error: () => undefined,
      });
  }

  toggleSave(post: CommunityPost): void {
    this.service
      .toggleSave(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.patch(post.id, { savedByMe: r.saved }),
        error: () => undefined,
      });
  }

  remove(post: CommunityPost): void {
    this.service
      .remove(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.load(), error: () => undefined });
  }

  /** Saves the post, then uploads the picture if the author attached one. */
  write(input: WritePostInput, photo: File | null, onDone: () => void): void {
    this.service
      .write(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          if (!photo) {
            this.finishWrite(onDone);
            return;
          }
          this.service
            .addPhoto(created._id, photo, photo.name)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.finishWrite(onDone),
              error: () => this.finishWrite(onDone),
            });
        },
        error: () => this.status.set('ERROR'),
      });
  }

  private finishWrite(onDone: () => void): void {
    this.page.set(1);
    this.load();
    onDone();
  }

  private patch(id: string, change: Partial<CommunityPost>): void {
    this.posts.update((list) => list.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }
}
