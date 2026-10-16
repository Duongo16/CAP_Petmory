import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Anh nen chay vong lap phia sau: cac be that, lam mo va nhat di. */
const AMBIENT = ['ambient-1', 'ambient-2', 'ambient-3', 'ambient-4'];

/**
 * Canh dau trang gioi thieu bang anh thu cung that.
 *
 * Hai lop: phia sau la mot vong anh cac be thay nhau hien len, lam mo va nhat
 * di nhu mot doan phim; phia truoc la cuon so that, hai tam anh dan bang keo va
 * hai be da tach nen, nhe nhang chuyen dong. Anh lay tu Unsplash, nguon ghi o
 * public/img/landing/CREDITS.md.
 */
@Component({
  selector: 'pm-pet-hero',
  standalone: true,
  templateUrl: './pet-hero.html',
  styleUrl: './pet-hero.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetHero {
  protected readonly ambient = AMBIENT.map((name, index) => ({ src: `/img/landing/${name}.webp`, index }));
}
