import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminOrderDetailFacade, DESK_STAGE_KEYS } from './admin-order-detail-facade';
import { AuthService } from '../../core/services/auth.service';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'pm-admin-order-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    MatProgressSpinnerModule,
    TranslatePipe,
    MoneyPipe,
  ],
  providers: [AdminOrderDetailFacade],
  templateUrl: './admin-order-detail-page.html',
  styleUrl: './admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly facade = inject(AdminOrderDetailFacade);
  readonly stageKeys = DESK_STAGE_KEYS;
  readonly isManager = inject(AuthService).isManager;

  /** Tich hoac bo tich mot muc tren phieu kiem tra chat luong. */
  tickChanged(at: number, event: Event): void {
    this.facade.setQualityTick(at, (event.target as HTMLInputElement).checked);
  }

  ngOnInit(): void {
    this.facade.start(this.route.snapshot.paramMap.get('orderCode') ?? '');
  }
}
