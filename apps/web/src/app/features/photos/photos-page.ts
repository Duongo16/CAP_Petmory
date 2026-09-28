import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AngleSlot, PhotosFacade } from './photos-facade';
import { RestoreOperation } from '../../core/models/api.model';

interface OperationChoice {
  code: RestoreOperation;
  key: string;
}

const OPERATIONS: OperationChoice[] = [
  { code: 'UPSCALE', key: 'PHOTO.OPERATION.UPSCALE' },
  { code: 'SHARPEN', key: 'PHOTO.OPERATION.SHARPEN' },
  { code: 'DENOISE', key: 'PHOTO.OPERATION.DENOISE' },
  { code: 'EXPOSURE', key: 'PHOTO.OPERATION.EXPOSURE' },
  { code: 'CONTRAST', key: 'PHOTO.OPERATION.CONTRAST' },
];

const DEFAULT: RestoreOperation[] = ['UPSCALE', 'SHARPEN', 'EXPOSURE'];

@Component({
  selector: 'pm-photos-page',
  standalone: true,
  imports: [
    RouterLink,
    A11yModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  providers: [PhotosFacade],
  templateUrl: './photos-page.html',
  styleUrl: './photos-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotosPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly facade = inject(PhotosFacade);

  private readonly selected = signal<RestoreOperation[]>(DEFAULT);

  /** Precomputes the checked state so the view calls no functions. */
  readonly operations = computed(() =>
    OPERATIONS.map((op) => ({ ...op, chosen: this.selected().includes(op.code) })),
  );

  /** The slot whose comparison is open, precomputed so the view does not re-scan. */
  readonly cellCompare = computed<AngleSlot | null>(() => {
    const code = this.facade.pendingCompare();
    if (!code) {
      return null;
    }
    return this.facade.tiles().find((o) => o.photo?.raw._id === code && o.versionRestore) ?? null;
  });

  ngOnInit(): void {
    this.facade.start(this.route.snapshot.paramMap.get('id') ?? '');
  }

  changeOperation(code: RestoreOperation, toggle: boolean): void {
    this.selected.update((ds) => (toggle ? [...ds, code] : ds.filter((x) => x !== code)));
  }

  selectFile(o: AngleSlot, su: Event): void {
    const input = su.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.facade.load(o.angle, file);
    }
        // Clear the previous selection so picking the same file again still fires the event.
    input.value = '';
  }

  startRestore(codePhoto: string): void {
    this.facade.restore(codePhoto, this.selected());
  }
}
