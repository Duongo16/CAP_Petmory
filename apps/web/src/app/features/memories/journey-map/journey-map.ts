import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Memory, PetStory } from '../../../core/models/api.model';
import { Icon } from '../../../shared/icon/icon';
import { MonthGroup } from '../memories-facade';

/**
 * Ban do hanh trinh: mot con duong uon luon, moi thang la mot tam bien, moi
 * khoanh khac la mot diem dung voi tam buu thiep ben canh.
 *
 * Dung chung cho nhat ky ca nhan (sua, xoa duoc) va nhat ky cong khai (chi xem).
 */
@Component({
  selector: 'pm-journey-map',
  standalone: true,
  imports: [DatePipe, TranslatePipe, Icon],
  templateUrl: './journey-map.html',
  styleUrl: './journey-map.scss',
  host: { '[class.bare]': 'bare()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyMap {
  readonly months = input.required<MonthGroup[]>();
  /** Ve diem khoi dau "ngay be ve nha" o cuoi duong, khi da toi trang cu nhat. */
  readonly showStart = input(true);
  readonly petName = input('');
  /** Hien nut xoa tren tung buu thiep; chi bat o nhat ky cua chinh chu. */
  readonly editable = input(false);
  /** Bo lop giay kem cham bi, de con duong nam thang tren nen chung cua trang. */
  readonly bare = input(false);

  readonly removed = output<Memory>();
  readonly readStory = output<{ story: PetStory; moment: Memory }>();
}
