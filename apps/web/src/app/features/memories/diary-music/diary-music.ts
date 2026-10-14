import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect,
  inject, input, output, signal, viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { DiaryMusic, Pet } from '../../../core/models/api.model';
import { MemoriesService } from '../../../core/services/memories.service';

const SAMPLES = [
  { code: 'HOP_NHAC_DIU_DANG', key: 'BOOK.MUSIC_SAMPLE_GENTLE', url: '/music/hop-nhac-diu-dang.wav' },
  { code: 'HOP_NHAC_NANG_SOM', key: 'BOOK.MUSIC_SAMPLE_MORNING', url: '/music/hop-nhac-nang-som.wav' },
] as const;

/** Nhac nen cua mot quyen: chu chon bai, moi nguoi doc deu nghe cung bai. */
@Component({
  selector: 'pm-diary-music',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './diary-music.html',
  styleUrl: './diary-music.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryMusicPlayer {
  private readonly service = inject(MemoriesService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly player = viewChild<ElementRef<HTMLAudioElement>>('player');

  readonly petId = input.required<string>();
  readonly music = input.required<DiaryMusic>();
  readonly canEdit = input(false);
  readonly publicAccess = input(false);
  readonly shareCode = input('');
  readonly active = input(true);
  readonly changed = output<Pet>();

  readonly samples = SAMPLES;
  readonly fileUrl = signal('');
  readonly blocked = signal(false);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly problem = signal('');
  readonly link = signal('');

  readonly sampleUrl = computed(() => SAMPLES.find((one) => one.code === this.music().sampleCode)?.url ?? '');
  readonly sampleTitleKey = computed(() => SAMPLES.find((one) => one.code === this.music().sampleCode)?.key ?? '');
  readonly audioUrl = computed(() => this.music().source === 'SAMPLE' ? this.sampleUrl() : this.fileUrl());
  readonly youtubeUrl = computed<SafeResourceUrl | null>(() => {
    const id = this.music().youtubeId;
    if (this.music().source !== 'YOUTUBE' || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&controls=1&loop=1&playlist=${id}`,
    );
  });
  readonly youtubePage = computed(() => `https://www.youtube.com/watch?v=${this.music().youtubeId}`);

  constructor() {
    effect((onCleanup) => {
      const current = this.music();
      const petId = this.petId();
      const publicAccess = this.publicAccess();
      const shareCode = this.shareCode();
      this.fileUrl.set('');
      this.loadFailed.set(false);
      if (current.source !== 'UPLOAD') return;
      let objectUrl = '';
      const subscription = this.service.diaryMusicFile(petId, publicAccess, shareCode).subscribe({
        next: (blob) => {
          objectUrl = URL.createObjectURL(blob);
          this.fileUrl.set(objectUrl);
        },
        error: () => this.loadFailed.set(true),
      });
      onCleanup(() => {
        subscription.unsubscribe();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      });
    });

    // Sau khi tai xong tep, thu phat ngay. Trinh duyet co the tu choi neu chua co tuong tac.
    effect((onCleanup) => {
      const url = this.audioUrl();
      const audio = this.player()?.nativeElement;
      const active = this.active();
      if (!url || !audio || !active) return;
      const timer = setTimeout(() => {
        audio.load();
        void audio.play().then(() => this.blocked.set(false)).catch(() => this.blocked.set(true));
      }, 0);
      onCleanup(() => clearTimeout(timer));
    });
  }

  play(): void {
    const audio = this.player()?.nativeElement;
    if (audio) void audio.play().then(() => this.blocked.set(false)).catch(() => this.blocked.set(true));
  }

  saveSample(event: Event): void {
    const code = (event.target as HTMLSelectElement).value;
    if (!code || this.saving()) return;
    this.save(this.service.setSampleMusic(this.petId(), code));
  }

  upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.saving()) return;
    if (file.size > 4 * 1024 * 1024 || !/\.(mp3|m4a|ogg|wav)$/i.test(file.name)) {
      this.problem.set('BOOK.MUSIC_BAD_FILE');
      return;
    }
    this.save(this.service.uploadMusic(this.petId(), file));
  }

  saveYoutube(): void {
    const url = this.link().trim();
    if (!url || this.saving()) return;
    this.save(this.service.setYoutubeMusic(this.petId(), url));
  }

  clear(): void {
    if (this.saving()) return;
    this.save(this.service.clearMusic(this.petId()));
  }

  private save(request: ReturnType<MemoriesService['clearMusic']>): void {
    this.problem.set('');
    this.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (pet) => {
        this.saving.set(false);
        this.link.set('');
        this.changed.emit(pet);
      },
      error: () => {
        this.saving.set(false);
        this.problem.set('BOOK.MUSIC_SAVE_FAILED');
      },
    });
  }
}
