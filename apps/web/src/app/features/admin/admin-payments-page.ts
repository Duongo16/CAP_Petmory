import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminPaymentsFacade, LogGroup } from './admin-payments-facade';
import { MoneyPipe } from '../../shared/money.pipe';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'pm-admin-payments-page',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './admin-payments-page.html',
  styleUrls: ['./admin-shared.scss', './admin-payments-page.scss'],
  providers: [AdminPaymentsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPaymentsPage implements OnInit {
  readonly facade = inject(AdminPaymentsFacade);
  /** Doi soat goi ra ngoai va ghi nhan tien, nen chi nhom Quan ly thay nut. May chu kiem lai quyen. */
  readonly isManager = inject(AuthService).isManager;

  ngOnInit(): void {
    this.facade.reload();
  }

  choose(group: LogGroup): void {
    this.facade.choose(group);
  }
}
