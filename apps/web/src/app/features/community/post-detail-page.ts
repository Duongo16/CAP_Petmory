import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { CommunityService } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { PostComment, PostDetail } from '../../core/models/community.model';
import { topicKey } from './community-topics';
import { Icon } from '../../shared/icon/icon';
import { UserFace } from '../../shared/user-face/user-face';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

@Component({
  selector: 'pm-post-detail-page',
  standalone: true,
  imports: [UserFace, FormsModule, RouterLink, DatePipe, TranslatePipe, MatProgressSpinnerModule, Icon],
  templateUrl: './post-detail-page.html',
  styleUrl: './post-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostDetailPage implements OnInit {
  private readonly service = inject(CommunityService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** Post id from the URL, via the router's parameter binding. */
  readonly id = input.required<string>();

  readonly user = this.auth.user;
  readonly status = signal<ScreenState>('LOADING');
  readonly data = signal<PostDetail | null>(null);
  readonly comments = signal<PostComment[]>([]);
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly photoIndex = signal(0);

  /** Precomputes the topic key so the view calls no functions. */
  readonly topicKey = computed(() => {
    const post = this.data()?.post;
    return post ? topicKey(post.topic) : '';
  });

  readonly photoUrls = computed(() => {
    const post = this.data()?.post;
    return post ? post.photos.map((f) => this.service.photoUrl(post.id, f)) : [];
  });

  readonly currentPhoto = computed(() => this.photoUrls()[this.photoIndex()] ?? '');

  readonly relatedCards = computed(() =>
    (this.data()?.related ?? []).map((p) => ({
      raw: p,
      topicKey: topicKey(p.topic),
      cover: p.photos.length > 0 ? this.service.photoUrl(p.id, p.photos[0]) : '',
    })),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.status.set('LOADING');
    this.service
      .detail(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.photoIndex.set(0);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });

    this.service
      .comments(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.comments.set(c), error: () => undefined });
  }

  showPhoto(step: number): void {
    const count = this.photoUrls().length;
    if (count === 0) {
      return;
    }
    this.photoIndex.set((this.photoIndex() + step + count) % count);
  }

  pickPhoto(index: number): void {
    this.photoIndex.set(index);
  }

  toggleLike(): void {
    const post = this.data()?.post;
    if (!post) {
      return;
    }
    this.service
      .toggleLike(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) =>
          this.data.update((d) =>
            d ? { ...d, post: { ...d.post, likedByMe: r.liked, likeCount: r.likeCount } } : d,
          ),
        error: () => undefined,
      });
  }

  toggleSave(): void {
    const post = this.data()?.post;
    if (!post) {
      return;
    }
    this.service
      .toggleSave(post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) =>
          this.data.update((d) => (d ? { ...d, post: { ...d.post, savedByMe: r.saved } } : d)),
        error: () => undefined,
      });
  }

  toggleFollow(): void {
    const post = this.data()?.post;
    if (!post) {
      return;
    }
    this.service
      .toggleFollow(post.author.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) =>
          this.data.update((d) =>
            d ? { ...d, author: { ...d.author, followedByMe: r.following } } : d,
          ),
        error: () => undefined,
      });
  }

  send(): void {
    const text = this.draft().trim();
    if (!text || this.sending()) {
      return;
    }
    this.sending.set(true);
    this.service
      .comment(this.id(), text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.draft.set('');
          this.sending.set(false);
          this.load();
        },
        error: () => this.sending.set(false),
      });
  }
}
