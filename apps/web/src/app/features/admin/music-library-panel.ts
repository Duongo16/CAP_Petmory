import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminService } from '../../core/services/admin.service';
import { MusicTrack } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';

/** Toi da bao nhieu bai, giu bang phia may chu. */
const TRACK_MAX = 50;

/** Duong dan nhac: lien ket web hoac tep trong thu muc nhac cua trang. */
const TRACK_URL = /^(https?:\/\/\S{3,490}|\/music\/[A-Za-z0-9._-]{1,100})$/;

const DEMO_CREDIT = 'Nhạc mẫu tạo tự động, cần thay bằng nhạc có bản quyền của Bên A';
const DEMO_TRACKS: MusicTrack[] = [
  { code: 'HOP_NHAC_DIU_DANG', title: 'Hộp nhạc dịu dàng', url: '/music/hop-nhac-diu-dang.wav', credit: DEMO_CREDIT },
  { code: 'HOP_NHAC_NANG_SOM', title: 'Hộp nhạc nắng sớm', url: '/music/hop-nhac-nang-som.wav', credit: DEMO_CREDIT },
];

type TrackForm = FormGroup<{
  code: FormControl<string>;
  title: FormControl<string>;
  url: FormControl<string>;
  credit: FormControl<string>;
}>;

/** Ma bai lay tu ten: bo dau, viet hoa, noi bang gach duoi. */
function codeFromTitle(title: string): string {
  const plain = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (plain || 'BAI_NHAC').slice(0, 50);
}

/**
 * Kho nhac nen cho trinh chieu ky niem (muc 19).
 *
 * Ma bai da luu thi giu nguyen vi nhat ky cua khach tham chieu theo ma, bai moi
 * duoc dat ma tu ten luc luu. Kho luu rieng, khong di chung nut luu tham so.
 */
@Component({
  selector: 'pm-music-library-panel',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Icon],
  templateUrl: './music-library-panel.html',
  styleUrl: './music-library-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MusicLibraryPanel {
  private readonly service = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tracks = input<MusicTrack[]>([]);
  readonly canEdit = input(false);

  readonly rows = new FormArray<TrackForm>([]);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly problem = signal<string | null>(null);
  readonly count = signal(0);
  readonly trackMax = TRACK_MAX;

  /** Chi nap lai khi danh sach tu may chu doi, khong theo doi tin hieu nao khac. */
  private readonly syncFromInput = effect(() => {
    const list = this.tracks();
    untracked(() => this.fill(list));
  });

  private readonly syncEditable = effect(() => {
    const can = this.canEdit();
    untracked(() => (can ? this.rows.enable() : this.rows.disable()));
  });

  add(track?: MusicTrack): void {
    if (this.rows.length >= TRACK_MAX) {
      this.problem.set('ADMIN.MUSIC.TOO_MANY');
      return;
    }
    this.rows.push(this.makeRow(track ?? { code: '', title: '', url: '', credit: '' }));
    this.afterChange();
  }

  addDemo(): void {
    const have = new Set(this.rows.controls.map((row) => row.controls.url.value));
    DEMO_TRACKS.filter((one) => !have.has(one.url)).forEach((one) => this.add(one));
  }

  remove(index: number): void {
    this.rows.removeAt(index);
    this.afterChange();
  }

  save(): void {
    this.problem.set(null);
    this.saved.set(false);
    this.rows.markAllAsTouched();
    if (this.rows.invalid) {
      this.problem.set('ADMIN.MUSIC.INVALID');
      return;
    }
    const list = this.toTracks();
    if (new Set(list.map((one) => one.code)).size !== list.length) {
      this.problem.set('ADMIN.MUSIC.DUPLICATE');
      return;
    }
    this.saving.set(true);
    this.service
      .updateMusicLibrary(list)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => {
          this.saving.set(false);
          this.saved.set(true);
          this.fill(config.musicLibrary ?? list);
        },
        error: () => {
          this.saving.set(false);
          this.problem.set('COMMON.GENERIC_ERROR');
        },
      });
  }

  private toTracks(): MusicTrack[] {
    const used = new Set(this.rows.controls.map((row) => row.controls.code.value).filter(Boolean));
    return this.rows.controls.map((row) => {
      const value = row.getRawValue();
      let code = value.code;
      if (!code) {
        const base = codeFromTitle(value.title);
        code = base;
        for (let n = 2; used.has(code); n++) {
          code = `${base}_${n}`;
        }
        used.add(code);
      }
      const track: MusicTrack = { code, title: value.title.trim(), url: value.url.trim() };
      const credit = value.credit.trim();
      return credit ? { ...track, credit } : track;
    });
  }

  private fill(list: MusicTrack[]): void {
    this.rows.clear();
    list.forEach((one) => this.rows.push(this.makeRow(one)));
    this.afterChange();
  }

  private afterChange(): void {
    this.count.set(this.rows.length);
    if (!untracked(this.canEdit)) {
      this.rows.disable();
    }
  }

  private makeRow(track: MusicTrack): TrackForm {
    return new FormGroup({
      code: new FormControl(track.code, { nonNullable: true }),
      title: new FormControl(track.title, {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(200)],
      }),
      url: new FormControl(track.url, {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(TRACK_URL)],
      }),
      credit: new FormControl(track.credit ?? '', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    });
  }
}
