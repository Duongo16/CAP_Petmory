import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Brand } from '../brand/brand';
import { SocialLinks } from '../social-links/social-links';

export interface FooterLink {
  path: string;
  key: string;
}

/**
 * Chan trang chung: logo, loi gioi thieu, cac duong kham pha va cot lien he.
 *
 * Khung chinh dung cho nguoi da dang nhap; cac trang mo cho khach (nhat ky cong
 * khai) dung lai voi danh sach duong rieng cho khach.
 */
@Component({
  selector: 'pm-site-footer',
  standalone: true,
  imports: [RouterLink, TranslatePipe, Brand, SocialLinks],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  readonly menu = input.required<FooterLink[]>();
  /** Chua cho trong phia duoi cho thanh dieu huong day man hinh tren dien thoai. */
  readonly bottomNavRoom = input(false);
}
