import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Ba tam anh thu cung that dan bang keo giay, dung o cot anh cac trang dang nhap.
 *
 * Thay cho tranh ve hoat hinh truoc day. Anh lay chung bo voi trang gioi thieu,
 * nguon ghi o public/img/landing/CREDITS.md.
 */
@Component({
  selector: 'pm-auth-photos',
  standalone: true,
  templateUrl: './auth-photos.html',
  styleUrl: './auth-photos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPhotos {}
