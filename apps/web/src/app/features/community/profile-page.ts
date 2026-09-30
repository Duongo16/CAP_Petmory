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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommunityService } from '../../core/services/community.service';
import { AuthService } from '../../core/services/auth.service';
import { TokenStore } from '../../core/services/token-store';
import { CommunityPost, CommunityProfile } from '../../core/models/community.model';
import { topicKey } from './community-topics';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';

interface EditForm {
  fullName: FormControl<string>;
  phone: FormControl<string>;
  avatarUrl: FormControl<string>;
}

@Component({
  selector: 'pm-community-profile-page',
  standalone: true,
  imports: [RouterLink, DatePipe, TranslatePipe, MatProgressSpinnerModule, Icon, ReactiveFormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityProfilePage implements OnInit {
  private readonly service = inject(CommunityService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(TokenStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();

  readonly user = this.auth.user;
  readonly status = signal<ScreenState>('LOADING');
  readonly profile = signal<CommunityProfile | null>(null);
  private readonly posts = signal<CommunityPost[]>([]);

  readonly editMode = signal(false);
  readonly saving = signal(false);

  readonly editForm = new FormGroup<EditForm>({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    avatarUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

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
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });

    this.service
      .postsOf(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (list) => this.posts.set(list), error: () => undefined });
  }

  openEdit(): void {
    const p = this.profile();
    if (!p) {
      return;
    }
    this.editForm.setValue({
      fullName: p.fullName,
      phone: p.phone ?? '',
      avatarUrl: p.avatarUrl ?? '',
    });
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
  }

  saveProfile(): void {
    if (this.editForm.invalid || this.saving()) {
      return;
    }
    const { fullName, phone, avatarUrl } = this.editForm.getRawValue();
    this.saving.set(true);
    this.service
      .updateProfile({ fullName, phone, avatarUrl })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.profile.update((p) =>
            p
              ? {
                  ...p,
                  fullName,
                  initial: fullName.trim().charAt(0).toUpperCase() || '?',
                  phone: phone || null,
                  avatarUrl: avatarUrl || null,
                }
              : p,
          );
          this.store.patchUser({ fullName });
          this.saving.set(false);
          this.editMode.set(false);
        },
        error: () => this.saving.set(false),
      });
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
