import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommunityFacade, SCOPE_ORDER, scopeKey } from './community-facade';
import { TOPIC_ORDER, templateKey, topicKey } from './community-topics';
import { AuthService } from '../../core/services/auth.service';
import { CommunityPost, PostTopic } from '../../core/models/community.model';
import { SocialLinks } from '../../shared/social-links/social-links';
import { Icon } from '../../shared/icon/icon';

/** The five value lines along the bottom of the community screen. */
interface ValueLine {
  icon: string;
  titleKey: string;
  textKey: string;
}

@Component({
  selector: 'pm-community-page',
  standalone: true,
  imports: [
    FormsModule,
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
  private readonly translate = inject(TranslateService);

  readonly user = this.auth.user;

  /** Whether the write panel is open. */
  readonly composing = signal(false);
  readonly draftTopic = signal<PostTopic>('MOMENT');
  readonly draftTitle = signal('');
  readonly draftContent = signal('');
  readonly draftTags = signal<string[]>([]);
  readonly tagInput = signal('');
  readonly photo = signal<File | null>(null);
  readonly sending = signal(false);

  readonly topics = TOPIC_ORDER;
  readonly scopes = SCOPE_ORDER;

  /** Precomputes the scope chips so the view calls no functions. */
  readonly scopeChips = computed(() =>
    SCOPE_ORDER.map((s) => ({ scope: s, key: scopeKey(s) })),
  );

  /** Precomputes the topic options in the composer for the same reason. */
  readonly topicOptions = computed(() =>
    TOPIC_ORDER.map((t) => ({ topic: t, key: topicKey(t) })),
  );

  readonly photoName = computed(() => this.photo()?.name ?? '');

  readonly canSubmit = computed(
    () =>
      !this.sending() &&
      this.draftTitle().trim().length > 0 &&
      this.draftContent().trim().length > 0,
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
  }

  openComposer(topic: PostTopic): void {
    this.draftTopic.set(topic);
    this.composing.set(true);
  }

  closeComposer(): void {
    this.composing.set(false);
    this.draftTitle.set('');
    this.draftContent.set('');
    this.draftTags.set([]);
    this.tagInput.set('');
    this.photo.set(null);
  }

  /**
   * Fills the box with a ready-made opening line for the chosen topic. The
   * wording comes from the translation file, so nothing is generated here.
   */
  useTemplate(): void {
    const topic = this.draftTopic();
    this.translate
      .get([templateKey(topic), 'COMMUNITY.TEMPLATE.DEFAULT_PET'])
      .subscribe((text: Record<string, string>) => {
        const pet = text['COMMUNITY.TEMPLATE.DEFAULT_PET'];
        this.draftContent.set(text[templateKey(topic)].replace('{{pet}}', pet));
      });
  }

  addTag(): void {
    const tag = this.tagInput().trim();
    if (tag && this.draftTags().length < 6 && !this.draftTags().includes(tag)) {
      this.draftTags.update((list) => [...list, tag]);
    }
    this.tagInput.set('');
  }

  removeTag(tag: string): void {
    this.draftTags.update((list) => list.filter((t) => t !== tag));
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.photo.set(input.files?.[0] ?? null);
    // Clear the selection so picking the same file again still fires the event.
    input.value = '';
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.sending.set(true);
    this.facade.write(
      {
        topic: this.draftTopic(),
        title: this.draftTitle().trim(),
        content: this.draftContent().trim(),
        tags: this.draftTags(),
      },
      this.photo(),
      () => {
        this.sending.set(false);
        this.closeComposer();
      },
    );
  }

  confirmRemove(post: CommunityPost): void {
    this.facade.remove(post);
  }
}
