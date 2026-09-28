import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AdminOrdersFacade } from './admin-orders-facade';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'pm-admin-orders-page',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    MatProgressSpinnerModule,
    TranslatePipe,
    MoneyPipe,
  ],
  providers: [AdminOrdersFacade],
  templateUrl: './admin-orders-page.html',
  styleUrl: './admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrdersPage implements OnInit {
  readonly facade = inject(AdminOrdersFacade);

  ngOnInit(): void {
    this.facade.reload();
  }
}
