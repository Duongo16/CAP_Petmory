import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { TranslatePipe } from '@ngx-translate/core';
import { PetsService } from '../../core/services/pets.service';
import { Pet } from '../../core/models/api.model';

type ScreenState = 'LOADING' | 'ERROR' | 'EMPTY' | 'HAS_DATA';

@Component({
  selector: 'pm-pets-page',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    TranslatePipe,
  ],
  templateUrl: './pets-page.html',
  styleUrl: './pets-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetsPage implements OnInit {
  private readonly service = inject(PetsService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly list = signal<Pet[]>([]);
  readonly status = signal<ScreenState>('LOADING');
  readonly errorAdd = signal<string | null>(null);
  readonly pendingAdd = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    kind: [''],
    breed: [''],
    status: ['TOGETHER' as Pet['status']],
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.status.set('LOADING');
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ds) => {
          this.list.set(ds);
          this.status.set(ds.length === 0 ? 'EMPTY' : 'HAS_DATA');
        },
        error: () => this.status.set('ERROR'),
      });
  }

  add(): void {
    if (this.form.invalid || this.pendingAdd()) {
      this.form.markAllAsTouched();
      return;
    }
    this.pendingAdd.set(true);
    this.errorAdd.set(null);
    this.service
      .create(this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (next) => {
          this.pendingAdd.set(false);
          this.list.update((ds) => [next, ...ds]);
          this.status.set('HAS_DATA');
          this.form.reset({ name: '', kind: '', breed: '', status: 'TOGETHER' });
        },
        error: (error: { status?: number }) => {
          this.pendingAdd.set(false);
          this.errorAdd.set(error.status === 403 ? 'PET.QUOTA_REACHED' : 'COMMON.GENERIC_ERROR');
        },
      });
  }

  hide(pet: Pet): void {
    this.service
      .hide(pet._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.list.update((ds) => ds.filter((x) => x._id !== pet._id));
          if (this.list().length === 0) {
            this.status.set('EMPTY');
          }
        },
        error: () => this.errorAdd.set('COMMON.GENERIC_ERROR'),
      });
  }

  /** Maps a status to a translation key, declared explicitly so keys stay greppable. */
  keyStatus(pet: Pet): string {
    return pet.status === 'PASSED_AWAY' ? 'PET.PASSED_AWAY' : 'PET.TOGETHER';
  }
}
