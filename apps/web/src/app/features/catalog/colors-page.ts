import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { CatalogService } from '../../core/services/catalog.service';
import { ColorCode, ColorGroup } from '../../core/models/api.model';

type Result =
  | { status: 'LOADING' }
  | { status: 'ERROR' }
  | { status: 'DONE'; list: ColorCode[] };

interface GroupDisplay {
  group: ColorGroup;
  keyTitle: string;
  list: ColorCode[];
}

const KEY_TITLE: Record<ColorGroup, string> = {
  FUR: 'PALETTE.FUR_GROUP',
  EYES_NOSE: 'PALETTE.EYES_NOSE_GROUP',
  ACCESSORY: 'PALETTE.GROUP_ACCESSORY',
};

const SORT_ORDER_GROUP: ColorGroup[] = ['FUR', 'EYES_NOSE', 'ACCESSORY'];

@Component({
  selector: 'pm-colors-page',
  standalone: true,
  imports: [MatCardModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './colors-page.html',
  styleUrl: './colors-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorsPage {
  private readonly service = inject(CatalogService);

  private readonly result = toSignal(
    this.service.color$.pipe(
      map((list): Result => ({ status: 'DONE', list })),
      catchError(() => of<Result>({ status: 'ERROR' })),
      startWith<Result>({ status: 'LOADING' }),
    ),
    { initialValue: { status: 'LOADING' } as Result },
  );

  readonly status = computed(() => this.result().status);

  readonly groups = computed<GroupDisplay[]>(() => {
    const result = this.result();
    if (result.status !== 'DONE') {
      return [];
    }
    return SORT_ORDER_GROUP.map((group) => ({
      group,
      keyTitle: KEY_TITLE[group],
      list: result.list.filter((color) => color.group === group),
    })).filter((item) => item.list.length > 0);
  });

  readonly empty = computed(() => this.status() === 'DONE' && this.groups().length === 0);
}
