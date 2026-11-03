import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../icon/icon';
import { arLinkFor } from '../../features/ar/ar-models';

/**
 * QR mo trang camera cua be, kem moi don khung thu cung.
 *
 * Ma QR chi la duong dan /ar/o/<ma AR cua don>, ma do luu trong don nen QR
 * luc nao ve lai cung nhu nhau. Thu vien ve QR chi tai khi co QR can ve, de
 * cac trang khac khong phai mang them.
 */
@Component({
  selector: 'pm-ar-qr',
  standalone: true,
  imports: [TranslatePipe, Icon],
  templateUrl: './ar-qr.html',
  styleUrl: './ar-qr.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArQr {
  /** Ma AR luu trong don. */
  readonly code = input.required<string>();
  /** Ma don, dat vao ten tep khi tai anh QR ve. */
  readonly orderCode = input('');

  readonly link = computed(() => arLinkFor(this.code()));
  readonly image = signal<string | null>(null);
  readonly fileName = computed(() => `petmory-ar-${this.orderCode() || this.code()}.png`);

  protected readonly draw = effect(async () => {
    const link = this.link();
    this.image.set(null);
    const { toDataURL } = await import('qrcode');
    // Mau dam tren nen trang: may nao cung quet duoc, in ra giay van ro.
    this.image.set(await toDataURL(link, { margin: 2, width: 480, color: { dark: '#2e1606', light: '#ffffff' } }));
  });
}
