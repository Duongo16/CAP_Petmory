import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, forkJoin } from 'rxjs';
import { MemoriesService } from '../../core/services/memories.service';
import { PetsService } from '../../core/services/pets.service';
import { StoriesService } from '../../core/services/stories.service';
import { Memory, Pet, PetStory, StoryTone } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'ERROR' | 'DONE';
type Busy = 'WRITE' | 'REWRITE' | 'SAVE' | 'ATTACH' | 'REMOVE' | null;

const TONE_ORDER: StoryTone[] = ['WARM', 'PLAYFUL', 'TENDER', 'SHORT'];
const TONE_KEY: Record<StoryTone, string> = {
  WARM: 'STORY.TONE.WARM',
  PLAYFUL: 'STORY.TONE.PLAYFUL',
  TENDER: 'STORY.TONE.TENDER',
  SHORT: 'STORY.TONE.SHORT',
};

/**
 * Cau chuyen AI ve mot be (muc 16).
 *
 * Moi lan viet hoac viet lai sinh mot ban moi, cac ban cu van con de so sanh.
 * Chu co the sua tay, gan mot ban vao khoanh khac trong nhat ky, hoac bo ban
 * khong dung. So luot con lai doc tu may chu sau moi lan viet.
 */
@Component({
  selector: 'pm-story-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslatePipe, Icon],
  templateUrl: './story-page.html',
  styleUrl: './story-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(StoriesService);
  private readonly memories = inject(MemoriesService);
  private readonly pets = inject(PetsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly pet = signal<Pet | null>(null);
  readonly stories = signal<PetStory[]>([]);
  readonly moments = signal<Memory[]>([]);
  readonly quotaLeft = signal(-1);
  readonly tone = signal<StoryTone>('WARM');
  readonly chosenId = signal<string | null>(null);
  readonly busy = signal<Busy>(null);
  readonly problem = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly confirmRemove = signal(false);

  readonly notes = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] });
  readonly rewriteNotes = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] });
  readonly attachTo = new FormControl('', { nonNullable: true });
  readonly editor = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    content: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(6000)] }),
  });

  readonly tones = computed(() =>
    TONE_ORDER.map((code) => ({ code, key: TONE_KEY[code], on: this.tone() === code })),
  );
  readonly chosen = computed(() => this.stories().find((one) => one._id === this.chosenId()) ?? null);
  readonly attachedTitle = computed(() => {
    const target = this.chosen()?.attachedMemory;
    return target ? (this.moments().find((one) => one._id === target)?.title ?? '') : '';
  });
  readonly outOfTurns = computed(() => this.quotaLeft() === 0);
  readonly toneKey = TONE_KEY;

  private petId = '';

  ngOnInit(): void {
    this.petId = this.route.snapshot.paramMap.get('id') ?? '';
    forkJoin({
      pet: this.pets.byId(this.petId),
      stories: this.service.list(this.petId),
      moments: this.memories.allForPet(this.petId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (all) => {
          this.pet.set(all.pet);
          this.moments.set(all.moments);
          this.stories.set(all.stories);
          this.choose(all.stories[0]?._id ?? null);
          this.status.set('DONE');
        },
        error: () => this.status.set('ERROR'),
      });
    this.readQuota();
  }

  pickTone(code: StoryTone): void {
    this.tone.set(code);
  }

  choose(id: string | null): void {
    this.chosenId.set(id);
    this.confirmRemove.set(false);
    this.notice.set(null);
    const one = this.stories().find((row) => row._id === id);
    this.editor.reset({ title: one?.title ?? '', content: one?.content ?? '' });
    this.attachTo.setValue(one?.attachedMemory ?? '');
    this.rewriteNotes.setValue(one?.notes ?? '');
  }

  write(): void {
    if (this.notes.invalid) {
      return;
    }
    this.run('WRITE', this.service.write(this.petId, this.tone(), this.notes.value.trim()), (made) => {
      this.stories.update((list) => [made, ...list]);
      this.notes.reset();
      this.choose(made._id);
      this.readQuota();
    });
  }

  rewrite(): void {
    const one = this.chosen();
    if (!one || this.rewriteNotes.invalid) {
      return;
    }
    this.run('REWRITE', this.service.rewrite(one._id, this.rewriteNotes.value.trim()), (made) => {
      this.stories.update((list) => [made, ...list]);
      this.choose(made._id);
      this.readQuota();
    });
  }

  save(): void {
    const one = this.chosen();
    this.editor.markAllAsTouched();
    if (!one || this.editor.invalid) {
      return;
    }
    const value = this.editor.getRawValue();
    this.run('SAVE', this.service.edit(one._id, value.title.trim(), value.content.trim()), (fresh) => {
      this.replace(fresh);
      this.notice.set('STORY.SAVED');
    });
  }

  attach(): void {
    const one = this.chosen();
    const target = this.attachTo.value;
    if (!one || !target) {
      return;
    }
    this.run('ATTACH', this.service.attach(one._id, target), (fresh) => {
      this.replace(fresh);
      this.moments.update((list) =>
        list.map((row) => (row._id === target ? { ...row, body: fresh.content.slice(0, 4000) } : row)),
      );
      this.notice.set('STORY.ATTACHED');
    });
  }

  remove(): void {
    const one = this.chosen();
    if (!one) {
      return;
    }
    if (!this.confirmRemove()) {
      this.confirmRemove.set(true);
      return;
    }
    this.run('REMOVE', this.service.remove(one._id), () => {
      const left = this.stories().filter((row) => row._id !== one._id);
      this.stories.set(left);
      this.choose(left[0]?._id ?? null);
    });
  }

  private replace(fresh: PetStory): void {
    this.stories.update((list) => list.map((row) => (row._id === fresh._id ? fresh : row)));
    this.editor.reset({ title: fresh.title, content: fresh.content });
  }

  private run(kind: Busy, call: Observable<PetStory>, done: (got: PetStory) => void): void {
    this.problem.set(null);
    this.notice.set(null);
    this.busy.set(kind);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (got) => {
        this.busy.set(null);
        done(got);
      },
      error: (trouble: HttpErrorResponse) => {
        this.busy.set(null);
        this.problem.set(problemKey(trouble.status, kind));
        if (trouble.status === 429) {
          this.readQuota();
        }
      },
    });
  }

  private readQuota(): void {
    this.service
      .quota()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (got) => this.quotaLeft.set(got.left), error: () => this.quotaLeft.set(-1) });
  }
}

function problemKey(status: number, kind: Busy): string {
  if (status === 429) {
    return 'STORY.QUOTA_OVER';
  }
  if (status === 400 && (kind === 'WRITE' || kind === 'REWRITE')) {
    return 'STORY.TOO_MANY';
  }
  if (status === 404) {
    return 'STORY.GONE';
  }
  return 'COMMON.GENERIC_ERROR';
}
