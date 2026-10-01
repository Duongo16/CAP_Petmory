import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PostTopic } from '../../core/models/community.model';
import { TOPIC_ORDER, templateKey, topicKey } from './community-topics';
import { Icon } from '../../shared/icon/icon';
import { ImageLink } from '../../shared/image-link/image-link';
import { PhotoPreviews } from '../../shared/photo-previews/photo-previews';

/** Hop thoai duoc mo voi chu de nao. */
export interface PostComposerInput {
  topic: PostTopic;
}

/** Hop thoai tra lai gi. Trang goi moi la noi gui bai len may chu. */
export interface PostComposerResult {
  topic: PostTopic;
  title: string;
  content: string;
  tags: string[];
  photo: File[];
  /** Anh dan tu duong dan tren mang, may chu se tu tai ve. */
  photoLink: string[];
}

/** So anh nhieu nhat dinh kem mot bai. */
const PHOTO_MAX = 5;

/** So the nhieu nhat gan duoc cho mot bai. */
const TAG_MAX = 6;

/** Cho trong mau van de thay bang ten thu cung. */
const PET_SLOT = '{{pet}}';

/** Key cua ten thu cung mac dinh trong mau van. */
const KEY_DEFAULT_PET = 'COMMUNITY.TEMPLATE.DEFAULT_PET';

/**
 * Hop thoai viet mot bai cong dong.
 *
 * Truoc day bieu mau nay nam thang trong dong tin, day len het phan tren man
 * hinh. Dua vao hop thoai thi dong tin giu nguyen cho, va viec viet bai co cho
 * rong hon.
 */
@Component({
  selector: 'pm-post-composer-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, Icon, ImageLink, PhotoPreviews],
  templateUrl: './post-composer-dialog.html',
  styleUrl: './post-composer-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostComposerDialog {
  private readonly ref = inject<MatDialogRef<PostComposerDialog, PostComposerResult>>(MatDialogRef);
  private readonly data = inject<PostComposerInput>(MAT_DIALOG_DATA);
  private readonly translate = inject(TranslateService);

  readonly topic = signal<PostTopic>(this.data.topic);
  readonly title = signal('');
  readonly content = signal('');
  readonly tags = signal<string[]>([]);
  readonly tagInput = signal('');
  readonly photo = signal<File[]>([]);
  readonly photoLink = signal<string[]>([]);
  readonly photoError = signal<string | null>(null);

  readonly photoMax = PHOTO_MAX;

  /** Tong so anh dang dinh kem, tinh ca tep lan duong dan. */
  readonly photoCount = computed(() => this.photo().length + this.photoLink().length);
  readonly photoFull = computed(() => this.photoCount() >= PHOTO_MAX);

  /** Cac chu de kem key ban dich, tinh san de khung nhin khong goi ham. */
  readonly topicOptions = TOPIC_ORDER.map((one) => ({ topic: one, key: topicKey(one) }));

  readonly canSubmit = computed(
    () => this.title().trim().length > 0 && this.content().trim().length > 0,
  );

  /**
   * Dien vao o noi dung mot cau mo dau co san theo chu de. Cau chu lay tu tep
   * ban dich, khong co chu nao duoc sinh ra o day.
   */
  useTemplate(): void {
    const key = templateKey(this.topic());
    this.translate.get([key, KEY_DEFAULT_PET]).subscribe((text: Record<string, string>) => {
      this.content.set(text[key].replace(PET_SLOT, text[KEY_DEFAULT_PET]));
    });
  }

  addTag(): void {
    const tag = this.tagInput().trim();
    if (tag && this.tags().length < TAG_MAX && !this.tags().includes(tag)) {
      this.tags.update((list) => [...list, tag]);
    }
    this.tagInput.set('');
  }

  removeTag(tag: string): void {
    this.tags.update((list) => list.filter((one) => one !== tag));
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    this.photoError.set(null);
    if (this.photoCount() + chosen.length > PHOTO_MAX) {
      this.photoError.set('COMMUNITY.COMPOSER.TOO_MANY');
      return;
    }
    this.photo.update((list) => [...list, ...chosen]);
    // Xoa lua chon cu, de chon lai dung tep do van kich hoat su kien.
    input.value = '';
  }

  addLink(link: string): void {
    this.photoError.set(null);
    if (this.photoFull()) {
      this.photoError.set('COMMUNITY.COMPOSER.TOO_MANY');
      return;
    }
    if (!this.photoLink().includes(link)) {
      this.photoLink.update((list) => [...list, link]);
    }
  }

  dropLink(index: number): void {
    this.photoLink.update((list) => list.filter((_, at) => at !== index));
    this.photoError.set(null);
  }

  dropPhoto(index: number): void {
    this.photo.update((list) => list.filter((_, at) => at !== index));
    this.photoError.set(null);
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.ref.close({
      topic: this.topic(),
      title: this.title().trim(),
      content: this.content().trim(),
      tags: this.tags(),
      photo: this.photo(),
      photoLink: this.photoLink(),
    });
  }

  close(): void {
    this.ref.close(undefined);
  }
}
