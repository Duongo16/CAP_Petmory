import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { DesignPreview } from '../../shared/design-preview/design-preview';
import { DesignsFacade } from './designs-facade';

/**
 * Thiet ke cua toi: moi ban da luu tu ban len 3D.
 *
 * Tu day khach mo lai ban thiet ke de sua, them thang vao gio khi da chon san
 * pham va co, doi ten hoac xoa. Ban dang nam trong gio thi khong xoa duoc, vi
 * luc dat hang xuong can chinh ban do.
 */
@Component({
  selector: 'pm-designs-page',
  standalone: true,
  imports: [RouterLink, DatePipe, TranslatePipe, Icon, DesignPreview],
  providers: [DesignsFacade],
  templateUrl: './designs-page.html',
  styleUrl: './designs-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignsPage implements OnInit {
  readonly facade = inject(DesignsFacade);

  readonly status = this.facade.status;
  readonly cards = this.facade.cards;

  ngOnInit(): void {
    this.facade.load();
  }

  saveName(id: string, event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const field = form.elements.namedItem('name') as HTMLInputElement | null;
    this.facade.rename(id, field?.value ?? '');
  }
}
