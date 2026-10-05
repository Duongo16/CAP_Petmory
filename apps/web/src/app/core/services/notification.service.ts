import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { take } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  showRoleRestrictedMessage(): void {
    const key = 'AUTH.ROLE_RESTRICTED';
    this.translate
      .get(key)
      .pipe(take(1))
      .subscribe((text) => {
        const message = text;
        const close = this.translate.instant('COMMON.CLOSE');
        this.snackBar.open(message, close, {
          duration: 4500,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['pm-snackbar-warning'],
        });
      });
  }
}
