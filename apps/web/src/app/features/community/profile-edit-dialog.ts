import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { CommunityService } from '../../core/services/community.service';
import { CommunityProfile } from '../../core/models/community.model';
import { Icon } from '../../shared/icon/icon';
import { map, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { avatarUploadErrorMessage } from '../../core/utils/avatar-upload-error';
import { looksLikeImage, PICK_MAX_BYTES } from '../../core/utils/upload-image';
import { normalizeVietnamesePhone, optionalVietnamesePhone } from '../../core/utils/vietnamese-phone';

/** What the profile hands back once it has been saved. */
export interface ProfileEditResult {
  fullName: string;
  phone: string;
  avatarUrl: string;
}

type AvatarSource = 'DEVICE' | 'LINK';
type Problem = { key?: string; message?: string };

interface EditForm {
  fullName: FormControl<string>;
  phone: FormControl<string>;
  avatarUrl: FormControl<string>;
}


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
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly initial = this.profile.initial;
  readonly source = signal<AvatarSource>('DEVICE');
  readonly uploading = signal(false);
  readonly saving = signal(false);
  readonly problem = signal<Problem | null>(null);
  private readonly persistedAvatarUrl = signal(this.profile.avatarUrl ?? '');

  readonly form = new FormGroup<EditForm>({
    fullName: new FormControl(this.profile.fullName, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    phone: new FormControl(this.profile.phone ?? '', {
      nonNullable: true,
      validators: [optionalVietnamesePhone],
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
    if (!looksLikeImage(file)) {
      this.problem.set({ key: 'COMMUNITY.PROFILE.AVATAR_TYPE_ERROR' });
      return;
    }
    if (file.size > PICK_MAX_BYTES) {
      this.problem.set({ key: 'COMMUNITY.PROFILE.AVATAR_SIZE_ERROR' });
      return;
    }
    this.problem.set(null);
    this.uploading.set(true);
    this.service
      .uploadAvatar(file)
      .pipe(
        switchMap((saved) => {
          const avatarUrl = this.service.avatarUrl(this.profile.id, saved.fileName);
          return this.service.updateProfile({ avatarUrl }).pipe(map(() => avatarUrl));
        }),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (avatarUrl) => {
          this.uploading.set(false);
          this.setPersistedAvatar(avatarUrl);
        },
        error: (trouble: unknown) => {
          this.uploading.set(false);
          const message = avatarUploadErrorMessage(trouble);
          this.problem.set(message ? { message } : { key: 'COMMUNITY.PROFILE.AVATAR_UPLOAD_FAILED' });
        },
      });
  }

  clearAvatar(): void {
    if (this.uploading() || this.saving() || !this.form.controls.avatarUrl.value) {
      return;
    }
    this.problem.set(null);
    this.uploading.set(true);
    this.service
      .updateProfile({ avatarUrl: '' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.uploading.set(false);
          this.setPersistedAvatar('');
        },
        error: (trouble: unknown) => {
          this.uploading.set(false);
          const message = avatarUploadErrorMessage(trouble);
          this.problem.set(message ? { message } : { key: 'COMMUNITY.PROFILE.AVATAR_UPLOAD_FAILED' });
        },
      });
  }

  normalizePhone(): void {
    const control = this.form.controls.phone;
    const normalized = normalizeVietnamesePhone(control.value);
    if (normalized !== control.value) {
      control.setValue(normalized);
    }
  }

  save(): void {
    this.normalizePhone();
    if (this.form.invalid || this.saving() || this.uploading()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const result: ProfileEditResult = {
      fullName: value.fullName.trim(),
      phone: value.phone,
      avatarUrl: value.avatarUrl.trim(),
    };
    this.saving.set(true);
    this.service
      .updateProfile(result)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.ref.close(result),
        error: (trouble: unknown) => {
          this.saving.set(false);
          const message = avatarUploadErrorMessage(trouble);
          this.problem.set(message ? { message } : { key: 'COMMON.GENERIC_ERROR' });
        },
      });
  }

  close(): void {
    const avatarUrl = this.persistedAvatarUrl();
    if (avatarUrl !== (this.profile.avatarUrl ?? '')) {
      this.ref.close({ fullName: this.profile.fullName, phone: this.profile.phone ?? '', avatarUrl });
      return;
    }
    this.ref.close();
  }

  private setPersistedAvatar(avatarUrl: string): void {
    this.persistedAvatarUrl.set(avatarUrl);
    this.form.controls.avatarUrl.setValue(avatarUrl);
    this.form.controls.avatarUrl.markAsPristine();
    this.auth.patchUser({ avatarUrl: avatarUrl || null });
  }
}
