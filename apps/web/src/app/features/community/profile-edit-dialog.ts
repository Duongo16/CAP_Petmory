import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityService } from '../../core/services/community.service';
import { CommunityProfile } from '../../core/models/community.model';
import { Icon } from '../../shared/icon/icon';

/** What the profile hands back once it has been saved. */
export interface ProfileEditResult {
  fullName: string;
  phone: string;
  avatarUrl: string;
}

type AvatarSource = 'DEVICE' | 'LINK';

interface EditForm {
  fullName: FormControl<string>;
  phone: FormControl<string>;
  avatarUrl: FormControl<string>;
}

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Editing one's own profile in a popup. The picture can come from the device,
 * uploaded the moment it is chosen, or from a link pasted in.
 */
@Component({
  selector: 'pm-profile-edit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Icon],
  templateUrl: './profile-edit-dialog.html',
  styleUrl: './profile-edit-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileEditDialog {
  private readonly profile = inject<CommunityProfile>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ProfileEditDialog, ProfileEditResult>);
  private readonly service = inject(CommunityService);
  private readonly destroyRef = inject(DestroyRef);

  readonly initial = this.profile.initial;
  readonly source = signal<AvatarSource>('DEVICE');
  readonly uploading = signal(false);
  readonly saving = signal(false);
  readonly problem = signal<string | null>(null);

  readonly form = new FormGroup<EditForm>({
    fullName: new FormControl(this.profile.fullName, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    phone: new FormControl(this.profile.phone ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(20)],
    }),
    avatarUrl: new FormControl(this.profile.avatarUrl ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(500), Validators.pattern(/^(https?:\/\/\S+)?$/)],
    }),
  });

  /** The picture as it will look, following both the upload and a typed link. */
  readonly preview = toSignal(this.form.controls.avatarUrl.valueChanges, {
    initialValue: this.form.controls.avatarUrl.value,
  });

  pickSource(source: AvatarSource): void {
    this.source.set(source);
    this.problem.set(null);
  }

  upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || this.uploading()) {
      return;
    }
    if (!PHOTO_TYPES.has(file.type)) {
      this.problem.set('COMMUNITY.PROFILE.AVATAR_TYPE_ERROR');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      this.problem.set('COMMUNITY.PROFILE.AVATAR_SIZE_ERROR');
      return;
    }
    this.problem.set(null);
    this.uploading.set(true);
    this.service
      .uploadAvatar(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.uploading.set(false);
          this.form.controls.avatarUrl.setValue(this.service.avatarUrl(this.profile.id, saved.fileName));
        },
        error: () => {
          this.uploading.set(false);
          this.problem.set('COMMUNITY.PROFILE.AVATAR_UPLOAD_FAILED');
        },
      });
  }

  clearAvatar(): void {
    this.form.controls.avatarUrl.setValue('');
  }

  save(): void {
    if (this.form.invalid || this.saving() || this.uploading()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const result: ProfileEditResult = {
      fullName: value.fullName.trim(),
      phone: value.phone.trim(),
      avatarUrl: value.avatarUrl.trim(),
    };
    this.saving.set(true);
    this.service
      .updateProfile(result)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.ref.close(result),
        error: () => {
          this.saving.set(false);
          this.problem.set('COMMON.GENERIC_ERROR');
        },
      });
  }

  close(): void {
    this.ref.close();
  }
}
