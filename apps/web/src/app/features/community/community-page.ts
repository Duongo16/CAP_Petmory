import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, NavigationStart, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { filter } from 'rxjs';
import { CommunityFacade, SCOPE_ORDER, scopeKey } from './community-facade';
import {
  PostComposerDialog,
  PostComposerInput,
  PostComposerResult,
} from './post-composer-dialog';
import { AuthService } from '../../core/services/auth.service';
import { CommunityPost, PostTopic } from '../../core/models/community.model';
import { SocialLinks } from '../../shared/social-links/social-links';
import { Icon } from '../../shared/icon/icon';
import { UserFace } from '../../shared/user-face/user-face';
import { PostDetailDialog, PostDetailRequest } from './post-detail-dialog';

/** The five value lines along the bottom of the community screen. */
interface ValueLine {
  icon: string;
  titleKey: string;
  textKey: string;
}

/** Ket qua dong popup khi nguoi dung bam sang man khac, de khong xoa duong dan moi. */
const LEFT = 'LEFT';

/** Kich thuoc hop thoai viet bai. */
const SHEET = { width: 'min(720px, 96vw)', maxHeight: '94vh', panelClass: 'pm-dialog' };

@Component({
  selector: 'pm-community-page',
  standalone: true,
  imports: [UserFace, 
    RouterLink,
    DatePipe,
    TranslatePipe,
    MatProgressSpinnerModule,
    SocialLinks,
    Icon,
  ],
  templateUrl: './community-page.html',
  styleUrl: './community-page.scss',
  providers: [CommunityFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityPage implements OnInit {
  readonly facade = inject(CommunityFacade);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly user = this.auth.user;

  /** Bai viet dang mo trong popup, theo tham so tren duong dan. */
  private open: { id: string; ref: MatDialogRef<PostDetailDialog, string> } | null = null;

  readonly sending = signal(false);

  /** Precomputes the scope chips so the view calls no functions. */
  readonly scopeChips = computed(() =>
    SCOPE_ORDER.map((s) => ({ scope: s, key: scopeKey(s) })),
  );

  readonly values: ValueLine[] = [
    { icon: 'user', titleKey: 'COMMUNITY.VALUES.CONNECT_TITLE', textKey: 'COMMUNITY.VALUES.CONNECT_TEXT' },
    { icon: 'heart', titleKey: 'COMMUNITY.VALUES.SHARE_TITLE', textKey: 'COMMUNITY.VALUES.SHARE_TEXT' },
    { icon: 'candle', titleKey: 'COMMUNITY.VALUES.MEMORIAL_TITLE', textKey: 'COMMUNITY.VALUES.MEMORIAL_TEXT' },
    { icon: 'bulb', titleKey: 'COMMUNITY.VALUES.LEARN_TITLE', textKey: 'COMMUNITY.VALUES.LEARN_TEXT' },
    { icon: 'star', titleKey: 'COMMUNITY.VALUES.SPREAD_TITLE', textKey: 'COMMUNITY.VALUES.SPREAD_TEXT' },
  ];

  ngOnInit(): void {
    this.facade.load();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('post');
      this.showPost(id ? { id, comment: params.get('comment') === '1' } : null);
    });

    // Mot lien ket trong popup dan ra khoi trang cong dong thi dong popup theo.
    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        if (this.open && !event.url.startsWith('/community?') && event.url !== '/community') {
          this.open.ref.close(LEFT);
        }
      });
  }

  /** Mo, doi hoac dong popup bai viet cho khop voi duong dan. */
  private showPost(wanted: PostDetailRequest | null): void {
    if (this.open && this.open.id === wanted?.id) {
      return;
    }
    this.open?.ref.close(LEFT);
    this.open = null;
    if (!wanted) {
      return;
    }
    const ref = this.dialog.open<PostDetailDialog, PostDetailRequest, string>(PostDetailDialog, {
      data: wanted,
      width: 'min(1120px, 96vw)',
      maxHeight: '92vh',
      panelClass: ['pm-dialog', 'pm-dialog-wide'],
      autoFocus: wanted.comment ? false : 'dialog',
    });
    this.open = { id: wanted.id, ref };
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((why) => {
        if (this.open?.ref === ref) {
          this.open = null;
        }
        // Luot thich va binh luan trong popup co the da doi, nen doc lai dong tin.
        this.facade.load();
        if (why !== LEFT) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { post: null, comment: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      });
  }

  /** Mo hop thoai viet bai, da chon san chu de nguoi dung bam vao. */
  openComposer(topic: PostTopic): void {
    const input: PostComposerInput = { topic };
    this.dialog
      .open<PostComposerDialog, PostComposerInput, PostComposerResult | undefined>(
        PostComposerDialog,
        { ...SHEET, data: input },
      )
      .afterClosed()
      .pipe(
        filter((result): result is PostComposerResult => result !== undefined),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.submit(result));
  }

  confirmRemove(post: CommunityPost): void {
    this.facade.remove(post);
  }

  private submit(result: PostComposerResult): void {
    this.sending.set(true);
    this.facade.write(
      {
        topic: result.topic,
        title: result.title,
        content: result.content,
        tags: result.tags,
      },
      result.photo,
      result.photoLink,
      () => this.sending.set(false),
    );
  }
}
