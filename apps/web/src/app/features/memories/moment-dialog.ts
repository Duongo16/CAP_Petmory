import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { DecorItem, Memory, MemoryTopic } from '../../core/models/api.model';
import { PhotosService } from '../../core/services/photos.service';
import { TOPIC_ORDER, topicKey } from '../../shared/memory-topics';
import { DIARY_LAYOUTS, DiaryLayout, LayoutCode, buildPage, layoutOf } from '../../shared/diary-layouts';
import { Icon } from '../../shared/icon/icon';
import { PageFace, PageFaceView } from './book/page-face';
import { looksLikeImage } from '../../core/utils/upload-image';

/** Album cua be, truyen vao de nguoi dung chon anh gan vao khoanh khac. */
export interface MomentRequest {
  petId: string;
  shots: { id: string; source: string }[];
}

/** What the dialog hands back when a moment is written. */
export interface MomentResult {
  title: string;
  body: string;
  happenedAt: string;
  place: string;
  topic: MemoryTopic;
  tag: string[];
  photo: string[];
  decor: DecorItem[];
  paper: string;
  isMilestone: boolean;
}

type Step = 1 | 2 | 3;


/** Splits what was typed into separate words, dropping the blanks. */
function asTags(typed: string): string[] {
  return typed
    .split(',')
    .map((one) => one.trim().replace(/^#/, ''))
    .filter((one) => one.length > 0);
}

/**
 * This moment as the value a date and time field expects.
 *
 * The time is kept as well as the day, because a diary reads better saying
 * a quarter past four than saying midnight for everything written down.
 */
function rightNow(): string {
  const now = new Date();
  const two = (value: number) => String(value).padStart(2, '0');
  return (
    `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}` +
    `T${two(now.getHours())}:${two(now.getMinutes())}`
  );
}

/**
 * Writing a diary page in three steps: pick how the page is laid out, pick the
 * photographs for it, then write the words while the page is drawn beside them.
 */
@Component({
  selector: 'pm-moment-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Icon, PageFaceView],
  templateUrl: './moment-dialog.html',
  styleUrl: './moment-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MomentDialog {
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject(MatDialogRef<MomentDialog, MomentResult>);
  private readonly data = inject<MomentRequest>(MAT_DIALOG_DATA);
  private readonly photos = inject(PhotosService);
  private readonly destroyRef = inject(DestroyRef);

  readonly step = signal<Step>(1);
  readonly layouts = DIARY_LAYOUTS;
  readonly layoutCode = signal<LayoutCode>('HERO');
  readonly layout = computed<DiaryLayout>(() => layoutOf(this.layoutCode()));
  readonly slotCount = computed(() => this.layout().photos.length);

  /** The album, plus anything uploaded from this dialog, newest first. */
  readonly shots = signal(this.data.shots);
  readonly uploading = signal(false);
  readonly uploadProblem = signal<string | null>(null);

  /** Preview addresses made for uploads here, freed when the dialog closes. */
  private readonly madeUrls: string[] = [];
  protected readonly freeUrls = this.destroyRef.onDestroy(() =>
    this.madeUrls.forEach((url) => URL.revokeObjectURL(url)),
  );

  /** Nhung buc anh dang duoc chon, theo dung thu tu nguoi dung bam vao. */
  private readonly picked = signal<string[]>([]);
  readonly chosenPhoto = this.picked.asReadonly();
  readonly full = computed(() => this.picked().length >= this.slotCount());

  readonly topics = TOPIC_ORDER.map((topic) => ({ value: topic, key: topicKey(topic) }));

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(200)]],
    body: ['', [Validators.maxLength(4000)]],
    happenedAt: [rightNow(), [Validators.required]],
    place: ['', [Validators.maxLength(200)]],
    topic: ['EVERYDAY' as MemoryTopic, [Validators.required]],
    tag: ['', [Validators.maxLength(300)]],
    isMilestone: [false],
  });

  private readonly typed = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly bodyLimit = computed(() => this.layout().body.limit);
  readonly bodyTooLong = computed(() => (this.typed().body ?? '').trim().length > this.bodyLimit());

  /** Address of every photograph by its id, for the page preview. */
  readonly sourceOf = computed<Record<string, string>>(() =>
    Object.fromEntries(this.shots().map((one) => [one.id, one.source])),
  );

  /** The page exactly as it will be drawn in the diary. */
  readonly previewFace = computed<PageFace>(() => {
    const raw = this.typed();
    const layout = this.layout();
    const moment: Memory = {
      _id: 'preview',
      pet: this.data.petId,
      title: raw.title ?? '',
      body: raw.body ?? '',
      happenedAt: new Date().toISOString(),
      place: raw.place ?? '',
      topic: raw.topic ?? 'EVERYDAY',
      tag: [],
      photo: this.picked(),
      decor: buildPage(layout, this.picked(), raw.title || '…', raw.body ?? ''),
      paper: layout.paper,
      isMilestone: false,
      createdAt: new Date().toISOString(),
    };
    return {
      kind: 'MOMENT',
      number: 1,
      moment,
      paper: layout.paper,
      petName: '',
      tagline: '',
      avatarUrl: '',
      momentCount: 0,
    };
  });

  pickLayout(code: LayoutCode): void {
    this.layoutCode.set(code);
    const slots = layoutOf(code).photos.length;
    this.picked.set(this.picked().slice(0, slots));
  }

  next(): void {
    if (this.step() === 1) {
      this.step.set(this.slotCount() > 0 ? 2 : 3);
      return;
    }
    if (this.step() === 2) {
      this.step.set(3);
    }
  }

  back(): void {
    if (this.step() === 3) {
      this.step.set(this.slotCount() > 0 ? 2 : 1);
      return;
    }
    if (this.step() === 2) {
      this.step.set(1);
    }
  }

  /** Bam mot lan la chon, bam lai la bo chon. Thu tu bam la thu tu anh. */
  togglePhoto(id: string): void {
    const now = this.picked();
    if (now.includes(id)) {
      this.picked.set(now.filter((one) => one !== id));
      return;
    }
    if (now.length >= this.slotCount()) {
      return;
    }
    this.picked.set([...now, id]);
  }

  /** Vi tri cua mot buc trong danh sach da chon, dem tu mot. Chua chon la khong. */
  orderOf(id: string): number {
    return this.picked().indexOf(id) + 1;
  }

  /** Doi cho mot buc anh voi buc lien truoc no, de sap lai thu tu. */
  moveEarlier(id: string): void {
    const now = [...this.picked()];
    const at = now.indexOf(id);
    if (at < 1) {
      return;
    }
    [now[at - 1], now[at]] = [now[at], now[at - 1]];
    this.picked.set(now);
  }

  /** Sends a picture from the device into the pet's album, then picks it. */
  upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || this.uploading()) {
      return;
    }
    if (!looksLikeImage(file)) {
      this.uploadProblem.set('MEMORY.UPLOAD_TYPE_ERROR');
      return;
    }
    this.uploadProblem.set(null);
    this.uploading.set(true);
    this.photos
      .loadGeneral(this.data.petId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.uploading.set(false);
          const source = URL.createObjectURL(file);
          this.madeUrls.push(source);
          this.shots.set([{ id: saved._id, source }, ...this.shots()]);
          if (!this.full()) {
            this.picked.set([...this.picked(), saved._id]);
          }
        },
        error: () => {
          this.uploading.set(false);
          this.uploadProblem.set('MEMORY.UPLOAD_FAILED');
        },
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const layout = this.layout();
    this.ref.close({
      title: raw.title.trim(),
      body: raw.body.trim(),
      happenedAt: new Date(raw.happenedAt).toISOString(),
      place: raw.place.trim(),
      topic: raw.topic,
      tag: asTags(raw.tag),
      photo: this.picked(),
      decor: buildPage(layout, this.picked(), raw.title, raw.body),
      paper: layout.paper,
      isMilestone: raw.isMilestone,
    });
  }

  close(): void {
    this.ref.close();
  }
}
