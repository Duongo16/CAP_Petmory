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
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, concatMap, exhaustMap, filter } from 'rxjs';
import { StoryEditDialog, StoryEditInput, StoryEditResult } from './story-edit-dialog';
import { AiService } from '../../core/services/ai.service';
import { PetsService } from '../../core/services/pets.service';
import { MemoriesService } from '../../core/services/memories.service';
import { Memory, Pet, PetStory, StoryToneChoice } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'READY' | 'ERROR';

/**
 * Tra key ban dich cho tung giong van.
 *
 * Khai ra tung key mot de tim duoc bang tim kiem chu. Khong bao gio ghep
 * key tu chuoi.
 */
const KEY_TONE: Record<string, string> = {
  WARM: 'STORY.TONE.WARM',
  PLAYFUL: 'STORY.TONE.PLAYFUL',
  TENDER: 'STORY.TONE.TENDER',
  SHORT: 'STORY.TONE.SHORT',
};

/** Kich thuoc hop thoai sua cau chuyen. */
const SHEET = { width: 'min(720px, 96vw)', maxHeight: '94vh', panelClass: 'pm-dialog' };

/** Mot yeu cau sua tay mot ban. */
interface EditWish {
  id: string;
  title: string;
  content: string;
}

/**
 * Viet cau chuyen ve thu cung bang tri tue nhan tao, theo Phu luc 01 muc 16.
 *
 * Nguon cua cau chuyen la ho so cua be cong voi cac y nguoi dung tu nhap.
 * Moi lan viet lai sinh mot ban moi, nen cac ban cu van con de so sanh. Mot
 * ban ung y duoc gan vao mot khoanh khac trong nhat ky.
 */
@Component({
  selector: 'pm-story-page',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, TranslatePipe, Icon],
  templateUrl: './story-page.html',
  styleUrl: './story-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryPage implements OnInit {
  private readonly service = inject(AiService);
  private readonly pets = inject(PetsService);
  private readonly memories = inject(MemoriesService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  /** Cac lan xin viet, xep hang de bam nhanh hai lan khong ton hai luot. */
  private readonly asked = new Subject<{ tone: string; notes: string }>();

  /** Cac lan xin viet lai. */
  private readonly rewrote = new Subject<{ id: string; notes: string }>();

  /**
   * Cac lan luu ban sua tay.
   *
   * Di lan luot chu khong song song, de hai lan luu nhanh khong ve dich sai
   * thu tu va ghi de len nhau.
   */
  private readonly saved = new Subject<EditWish>();

  /** Cac lan gan mot ban vao mot khoanh khac. */
  private readonly attached = new Subject<{ id: string; memoryId: string }>();

  readonly petId = signal('');
  readonly status = signal<ScreenState>('LOADING');
  readonly working = signal(false);
  readonly problem = signal('');
  readonly note = signal('');

  readonly pet = signal<Pet | null>(null);
  readonly toneList = signal<StoryToneChoice[]>([]);
  readonly stories = signal<PetStory[]>([]);
  readonly moments = signal<Memory[]>([]);
  readonly quotaLeft = signal(-1);

  readonly toneChosen = signal('WARM');
  readonly notesTyped = signal('');

  /** Ban dang mo ra doc, theo ma. Rong nghia la dang mo ban moi nhat. */
  readonly openId = signal('');

  /** Khoanh khac se gan ban dang mo vao. */
  readonly memoryChosen = signal('');

  /** Cac giong van kem key ban dich, tinh san de khung nhin khong goi ham. */
  readonly tones = computed(() =>
    this.toneList().map((one) => ({ key: one.key, textKey: KEY_TONE[one.key] ?? one.key })),
  );

  readonly open = computed<PetStory | null>(
    () => this.stories().find((one) => one._id === this.openId()) ?? this.stories()[0] ?? null,
  );

  readonly canAsk = computed(() => !this.working() && this.quotaLeft() !== 0);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.petId.set(id);

    this.pets.byId(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (got) => {
        this.pet.set(got);
        this.status.set('READY');
      },
      error: () => this.status.set('ERROR'),
    });

    this.service.storyTones().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (got) => this.toneList.set(got.tone),
      error: () => this.problem.set('STORY.ERROR_TONES'),
    });

    this.memories.forPet(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => this.moments.set(page.rows),
      error: () => this.moments.set([]),
    });

    this.reload();
    this.readQuota();

    this.asked
      .pipe(
        exhaustMap((wish) => this.service.writeStory(this.petId(), wish.tone, wish.notes)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (made) => this.afterWrite(made),
        error: (trouble: { status?: number }) => this.afterTrouble(trouble),
      });

    this.rewrote
      .pipe(
        exhaustMap((wish) => this.service.rewriteStory(wish.id, wish.notes)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (made) => this.afterWrite(made),
        error: (trouble: { status?: number }) => this.afterTrouble(trouble),
      });

    this.saved
      .pipe(
        concatMap((wish) => this.service.editStory(wish.id, wish.title, wish.content)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.working.set(false);
          this.note.set('STORY.SAVED');
          this.reload();
        },
        error: () => {
          this.working.set(false);
          this.problem.set('STORY.ERROR_SAVE');
        },
      });

    this.attached
      .pipe(
        concatMap((wish) => this.service.attachStory(wish.id, wish.memoryId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.working.set(false);
          this.note.set('STORY.ATTACHED');
          this.reload();
        },
        error: () => {
          this.working.set(false);
          this.problem.set('STORY.ERROR_ATTACH');
        },
      });
  }

  ask(): void {
    if (!this.canAsk()) {
      return;
    }
    this.begin();
    this.asked.next({ tone: this.toneChosen(), notes: this.notesTyped().trim() });
  }

  rewrite(): void {
    const one = this.open();
    if (!one || !this.canAsk()) {
      return;
    }
    this.begin();
    this.rewrote.next({ id: one._id, notes: this.notesTyped().trim() });
  }

  show(id: string): void {
    this.openId.set(id);
  }

  /** Mo hop thoai sua ban dang doc. Ban goc van nam do phia sau. */
  startEdit(): void {
    const one = this.open();
    if (!one || this.working()) {
      return;
    }
    const input: StoryEditInput = { title: one.title, content: one.content };
    this.dialog
      .open<StoryEditDialog, StoryEditInput, StoryEditResult | undefined>(StoryEditDialog, {
        ...SHEET,
        data: input,
      })
      .afterClosed()
      .pipe(
        filter((result): result is StoryEditResult => result !== undefined),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.begin();
        this.saved.next({ id: one._id, title: result.title, content: result.content });
      });
  }

  attach(): void {
    const one = this.open();
    if (!one || this.memoryChosen() === '' || this.working()) {
      return;
    }
    this.begin();
    this.attached.next({ id: one._id, memoryId: this.memoryChosen() });
  }

  private begin(): void {
    this.problem.set('');
    this.note.set('');
    this.working.set(true);
  }

  private afterWrite(made: PetStory): void {
    this.working.set(false);
    this.openId.set(made._id);
    this.reload();
    this.readQuota();
  }

  private afterTrouble(trouble: { status?: number }): void {
    this.working.set(false);
    this.problem.set(trouble?.status === 429 ? 'STORY.ERROR_QUOTA' : 'STORY.ERROR_WRITE');
    this.readQuota();
  }

  private reload(): void {
    this.service
      .storyList(this.petId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => this.stories.set(rows),
        error: () => this.problem.set('STORY.ERROR_LIST'),
      });
  }

  private readQuota(): void {
    this.service.storyQuota().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (got) => this.quotaLeft.set(got.left),
      error: () => this.quotaLeft.set(-1),
    });
  }
}
