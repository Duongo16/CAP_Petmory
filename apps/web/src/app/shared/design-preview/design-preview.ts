import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DesignsService } from '../../core/services/designs.service';
import { Icon } from '../icon/icon';

/**
 * Anh xem truoc cua mot ban thiet ke.
 *
 * Anh can dang nhap moi doc duoc, nen tai ve dang tep roi tao duong dan tam
 * trong trinh duyet. Duong dan tam duoc thu hoi khi doi anh hoac roi trang, de
 * khong giu bo nho.
 */
@Component({
  selector: 'pm-design-preview',
  standalone: true,
  imports: [Icon],
  templateUrl: './design-preview.html',
  styleUrl: './design-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignPreview {
  private readonly designs = inject(DesignsService);

  readonly designId = input.required<string>();
  /** Goc anh, rong nghia la ban thiet ke chua co anh nao. */
  readonly angle = input('ISO');
  /** Moc sua gan nhat, doi moc thi tai lai anh. */
  readonly version = input('');
  readonly alt = input('');

  readonly src = signal<string | null>(null);

  private readonly load = effect((onCleanup) => {
    const id = this.designId();
    const angle = this.angle();
    const version = this.version();
    this.src.set(null);
    if (!id || !angle) {
      return;
    }
    let url: string | null = null;
    const sub = this.designs.previewBlob(id, angle, version).subscribe({
      next: (blob) => {
        url = URL.createObjectURL(blob);
        this.src.set(url);
      },
      // Khong co anh thi de khung giu cho, khong bao loi len trang.
      error: () => this.src.set(null),
    });
    onCleanup(() => {
      sub.unsubscribe();
      if (url) {
        URL.revokeObjectURL(url);
      }
    });
  });
}
