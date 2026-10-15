import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommunityService } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { CommunityPost, CommunityProfile } from '../../core/models/community.model';
import { topicKey } from './community-topics';
import { Icon } from '../../shared/icon/icon';
import { UserFace } from '../../shared/user-face/user-face';
import { PetFace } from '../../shared/pet-face/pet-face';
import { MemoriesService } from '../../core/services/memories.service';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

@Component({
  selector: 'pm-community-profile-page',
  standalone: true,
  imports: [PetFace, UserFace, RouterLink, DatePipe, TranslatePipe, MatProgressSpinnerModule, Icon],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityProfilePage implements OnInit {
  private readonly service = inject(CommunityService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly memories = inject(MemoriesService);

  readonly id = input.required<string>();

  readonly user = this.auth.user;
  readonly status = signal<ScreenState>('LOADING');
  readonly profile = signal<CommunityProfile | null>(null);
  private readonly posts = signal<CommunityPost[]>([]);
  readonly diaries = signal<import('../../core/models/api.model').DiaryCard[]>([]);


  readonly cards = computed(() =>
    this.posts().map((p) => ({
      raw: p,
      topicKey: topicKey(p.topic),
      cover: p.photos.length > 0 ? this.service.photoUrl(p.id, p.photos[0]) : '',
    })),
  );

  readonly empty = computed(() => this.status() === 'DONE' && this.posts().length === 0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.status.set('LOADING');
    this.service
      .profile(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.profile.set(p);
          this.diaries.set(p.diaries ?? []);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });

    this.service
      .postsOf(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.posts.set(list), error: () => undefined });

    this.memories.publicDiaries(1, undefined, undefined, this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.diaries.set(list.rows), error: () => this.diaries.set([]) });
  }

  toggleFollow(): void {
    const current = this.profile();
    if (!current) {
      return;
    }
    this.service
      .toggleFollow(current.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) =>
          this.profile.update((p) =>
            p
              ? {
                  ...p,
                  followedByMe: r.following,
                  followerCount: p.followerCount + (r.following ? 1 : -1),
                }
              : p,
          ),
        error: () => undefined,
      });
  }
}
