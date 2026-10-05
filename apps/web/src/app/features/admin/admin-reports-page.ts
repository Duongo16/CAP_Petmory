import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import { ReportsService } from '../../core/services/reports.service';
import { AuthService } from '../../core/services/auth.service';
import { AiCostReport, ProgressReport, RevenueReport } from '../../core/models/api.model';
import { KEY_STATUS_ORDER } from '../../shared/order-status';
import { OrderStatus } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon/icon';

Chart.register(...registerables);

type ScreenState = 'LOADING' | 'ERROR' | 'READY';
type WhichReport = 'revenue' | 'ai-cost' | 'progress';
type ViewMode = 'CHARTS' | 'TABLES';
type DatePreset = '7d' | '30d' | 'month' | 'year';

const AI_KIND_KEY: Record<string, string> = {
  restorePhoto: 'ADMIN.CONFIG.PRICE_RESTORE_PHOTO',
  designSuggestion: 'ADMIN.CONFIG.PRICE_DESIGN_SUGGESTION',
  storyWriting: 'ADMIN.CONFIG.PRICE_STORY_WRITING',
  chatReply: 'ADMIN.CONFIG.PRICE_CHAT_REPLY',
};

const AI_KIND_KEY_OTHER = 'ADMIN.REPORT.AI_OTHER';

const KIND_KEY: Record<string, string> = {
  MADE_TO_ORDER: 'ADMIN.REPORT.KIND_MADE',
  READY_MADE: 'ADMIN.REPORT.KIND_READY',
};

const KIND_KEY_OTHER = 'ADMIN.REPORT.KIND_OTHER';

const DEFAULT_DAYS = 30;
const DAY_MS = 86_400_000;

@Component({
  selector: 'pm-admin-reports-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, MoneyPipe, DatePipe, Icon],
  templateUrl: './admin-reports-page.html',
  styleUrls: ['./admin-shared.scss', './admin-reports-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportsPage implements OnInit, AfterViewInit {
  private readonly service = inject(ReportsService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly words = inject(TranslateService);

  readonly trendCanvas = viewChild<ElementRef<HTMLCanvasElement>>('trendCanvas');
  readonly kindCanvas = viewChild<ElementRef<HTMLCanvasElement>>('kindCanvas');
  readonly productsCanvas = viewChild<ElementRef<HTMLCanvasElement>>('productsCanvas');
  readonly statusCanvas = viewChild<ElementRef<HTMLCanvasElement>>('statusCanvas');
  readonly aiCanvas = viewChild<ElementRef<HTMLCanvasElement>>('aiCanvas');

  readonly seesMoney = inject(AuthService).isManager;

  readonly status = signal<ScreenState>('LOADING');
  readonly viewMode = signal<ViewMode>('CHARTS');
  readonly activePreset = signal<DatePreset | null>('30d');
  readonly revenue = signal<RevenueReport | null>(null);
  readonly aiCost = signal<AiCostReport | null>(null);
  readonly progress = signal<ProgressReport | null>(null);
  readonly downloading = signal<WhichReport | null>(null);
  readonly fileLink = signal('');
  readonly fileName = signal('');

  private chartInstances: Record<string, Chart> = {};

  readonly form = this.fb.nonNullable.group({
    from: [dayText(new Date(Date.now() - DEFAULT_DAYS * DAY_MS))],
    to: [dayText(new Date())],
  });

  private readonly cleanup = this.destroyRef.onDestroy(() => {
    this.release();
    this.destroyCharts();
  });

  readonly kindRows = computed(() => {
    const rev = this.revenue();
    const totalAmount = rev ? Number(rev.total) : 0;
    return (rev?.byKind ?? []).map((one, index) => {
      const amountNum = Number(one.amount);
      const percent = totalAmount > 0 ? Math.round((amountNum / totalAmount) * 100) : 0;
      const colors = ['#a8500c', '#5b6640', '#fb8b1f', '#8a5406'];
      return {
        raw: one,
        key: KIND_KEY[one.name] ?? KIND_KEY_OTHER,
        percent,
        color: colors[index % colors.length],
      };
    });
  });

  readonly aiRows = computed(() =>
    (this.aiCost()?.rows ?? []).map((one) => ({
      raw: one,
      key: AI_KIND_KEY[one.kind] ?? AI_KIND_KEY_OTHER,
    })),
  );

  readonly statusRows = computed(() =>
    (this.progress()?.byStatus ?? []).map((one) => ({
      raw: one,
      key: KEY_STATUS_ORDER[one.status as OrderStatus] ?? one.status,
    })),
  );

  readonly averageOrderValue = computed(() => {
    const rev = this.revenue();
    if (!rev || rev.orderCount === 0) return '0';
    const totalNum = Number(rev.total);
    if (!Number.isFinite(totalNum)) return '0';
    return String(Math.round(totalNum / rev.orderCount));
  });

  readonly aiRevenuePercent = computed(() => {
    const rev = this.revenue();
    const cost = this.aiCost();
    const revNum = rev ? Number(rev.total) : 0;
    const costNum = cost ? Number(cost.total) : 0;
    if (revNum <= 0 || costNum <= 0) return '0.0';
    return ((costNum / revNum) * 100).toFixed(1);
  });

  readonly onTimeRate = computed(() => {
    const prog = this.progress();
    if (!prog) return 100;
    const totalOrders = prog.byStatus.reduce((acc, curr) => acc + curr.count, 0);
    if (totalOrders <= 0) return 100;
    return Math.max(0, Math.round(((totalOrders - prog.lateCount) / totalOrders) * 100));
  });

  ngOnInit(): void {
    this.read();
  }

  ngAfterViewInit(): void {
    // Canvas elements will be bound after view render
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    if (mode === 'CHARTS') {
      setTimeout(() => this.renderCharts(), 60);
    }
  }

  applyPreset(preset: DatePreset): void {
    this.activePreset.set(preset);
    const now = new Date();
    let from: Date;

    switch (preset) {
      case '7d':
        from = new Date(Date.now() - 7 * DAY_MS);
        break;
      case '30d':
        from = new Date(Date.now() - 30 * DAY_MS);
        break;
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1);
        break;
    }

    this.form.patchValue({
      from: dayText(from),
      to: dayText(now),
    });

    this.read();
  }

  read(): void {
    this.status.set('LOADING');
    const period = this.periodOf();
    const money = this.seesMoney();

    forkJoin({
      revenue: money
        ? this.service.revenue(period).pipe(catchError(() => of(null)))
        : of(null),
      aiCost: money
        ? this.service.aiCost(period).pipe(catchError(() => of(null)))
        : of(null),
      progress: this.service.progress(period),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (all) => {
          this.revenue.set(all.revenue);
          this.aiCost.set(all.aiCost);
          this.progress.set(all.progress);
          this.status.set('READY');

          if (this.viewMode() === 'CHARTS') {
            setTimeout(() => this.renderCharts(), 60);
          }
        },
        error: () => this.status.set('ERROR'),
      });
  }

  private renderCharts(): void {
    if (this.viewMode() !== 'CHARTS' || this.status() !== 'READY') {
      return;
    }

    this.renderRevenueTrendChart();
    this.renderKindDoughnutChart();
    this.renderTopProductsBarChart();
    this.renderOrderStatusChart();
    this.renderAiCostChart();
  }

  private renderRevenueTrendChart(): void {
    const el = this.trendCanvas()?.nativeElement;
    if (!el) return;

    const rev = this.revenue();
    const daily = rev?.daily ?? [];
    const labels = daily.map((d) => formatDateLabel(d.date));
    const revenueData = daily.map((d) => Number(d.revenue));
    const ordersData = daily.map((d) => d.orderCount);

    this.initChart('trend', el, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: this.words.instant('ADMIN.REPORT.DAILY_REVENUE'),
            data: revenueData,
            borderColor: '#a8500c',
            backgroundColor: 'rgba(168, 80, 12, 0.12)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#a8500c',
            pointRadius: 4,
            pointHoverRadius: 6,
            yAxisID: 'y',
          },
          {
            label: this.words.instant('ADMIN.REPORT.DAILY_ORDERS'),
            data: ordersData,
            borderColor: '#5b6640',
            backgroundColor: '#5b6640',
            borderDash: [5, 5],
            pointRadius: 3,
            tension: 0.2,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Be Vietnam Pro' } } },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                if (ctx.dataset.yAxisID === 'y') {
                  return `${ctx.dataset.label}: ${formatVND(ctx.parsed.y)}`;
                }
                return `${ctx.dataset.label}: ${this.words.instant('ADMIN.REPORT.UNIT_ORDERS', { count: ctx.parsed.y })}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Be Vietnam Pro', size: 11 } },
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            ticks: {
              font: { family: 'Be Vietnam Pro', size: 11 },
              callback: (val: string | number) => formatVNDCompact(Number(val)),
            },
            grid: { color: 'rgba(120, 96, 66, 0.1)' },
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              precision: 0,
              font: { family: 'Be Vietnam Pro', size: 11 },
            },
          },
        },
      },
    });
  }

  private renderKindDoughnutChart(): void {
    const el = this.kindCanvas()?.nativeElement;
    if (!el) return;

    const rows = this.kindRows();
    const labels = rows.map((r) => this.words.instant(r.key));
    const data = rows.map((r) => Number(r.raw.amount));
    const colors = rows.map((r) => r.color);

    this.initChart('kind', el, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const total = data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((Number(ctx.raw) / total) * 100) : 0;
                return ` ${ctx.label}: ${formatVND(Number(ctx.raw))} (${pct}%)`;
              },
            },
          },
        },
        cutout: '68%',
      },
    });
  }

  private renderTopProductsBarChart(): void {
    const el = this.productsCanvas()?.nativeElement;
    if (!el) return;

    const list = [...(this.revenue()?.byProduct ?? [])]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 6);

    const labels = list.map((item) => item.name);
    const data = list.map((item) => Number(item.amount));

    this.initChart('products', el, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: this.words.instant('ADMIN.REPORT.REVENUE'),
            data,
            backgroundColor: '#a8500c',
            borderRadius: 6,
            hoverBackgroundColor: '#843e08',
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => ` ${formatVND(Number(ctx.parsed.x))}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              font: { family: 'Be Vietnam Pro', size: 11 },
              callback: (val: string | number) => formatVNDCompact(Number(val)),
            },
            grid: { color: 'rgba(120, 96, 66, 0.1)' },
          },
          y: {
            grid: { display: false },
            ticks: { font: { family: 'Be Vietnam Pro', size: 11 } },
          },
        },
      },
    });
  }

  private renderOrderStatusChart(): void {
    const el = this.statusCanvas()?.nativeElement;
    if (!el) return;

    const statusMapColors: Record<string, string> = {
      PENDING: '#e0870c',
      PAID: '#8a5406',
      IN_PRODUCTION: '#a8500c',
      SHIPPING: '#fb8b1f',
      COMPLETED: '#3a6248',
      CANCELLED: '#b3261e',
    };

    const rows = this.statusRows();
    const labels = rows.map((r) => this.words.instant(r.key));
    const data = rows.map((r) => r.raw.count);
    const colors = rows.map((r) => statusMapColors[r.raw.status] ?? '#6b5541');

    this.initChart('status', el, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: this.words.instant('ADMIN.REPORT.ORDER_COUNT'),
            data,
            backgroundColor: colors,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => ` ${this.words.instant('ADMIN.REPORT.UNIT_ORDERS', { count: ctx.parsed.y })}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Be Vietnam Pro', size: 11 } },
          },
          y: {
            ticks: { precision: 0, font: { family: 'Be Vietnam Pro', size: 11 } },
            grid: { color: 'rgba(120, 96, 66, 0.1)' },
          },
        },
      },
    });
  }

  private renderAiCostChart(): void {
    const el = this.aiCanvas()?.nativeElement;
    if (!el) return;

    const rows = this.aiRows();
    const labels = rows.map((r) => this.words.instant(r.key));
    const costs = rows.map((r) => Number(r.raw.cost));
    const counts = rows.map((r) => r.raw.count);

    this.initChart('ai', el, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: this.words.instant('ADMIN.REPORT.AI_COST'),
            data: costs,
            backgroundColor: '#a8500c',
            borderRadius: 6,
            yAxisID: 'y',
          },
          {
            label: this.words.instant('ADMIN.REPORT.USES'),
            data: counts,
            backgroundColor: '#5b6640',
            borderRadius: 6,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Be Vietnam Pro', size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                if (ctx.dataset.yAxisID === 'y') {
                  return `${ctx.dataset.label}: ${formatVND(Number(ctx.raw))}`;
                }
                return `${ctx.dataset.label}: ${this.words.instant('ADMIN.REPORT.UNIT_USES', { count: ctx.raw })}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Be Vietnam Pro', size: 10 } },
          },
          y: {
            position: 'left',
            ticks: {
              font: { family: 'Be Vietnam Pro', size: 11 },
              callback: (val: string | number) => formatVNDCompact(Number(val)),
            },
            grid: { color: 'rgba(120, 96, 66, 0.1)' },
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              precision: 0,
              font: { family: 'Be Vietnam Pro', size: 11 },
            },
          },
        },
      },
    });
  }

  private initChart(key: string, canvas: HTMLCanvasElement, config: any): void {
    if (this.chartInstances[key]) {
      this.chartInstances[key].destroy();
      delete this.chartInstances[key];
    }
    this.chartInstances[key] = new Chart(canvas, config);
  }

  private destroyCharts(): void {
    Object.values(this.chartInstances).forEach((c) => c.destroy());
    this.chartInstances = {};
  }

  fetchFile(which: WhichReport): void {
    this.downloading.set(which);
    this.service
      .fileOf(which, this.periodOf())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.release();
          this.fileLink.set(URL.createObjectURL(blob));
          this.fileName.set(`${which}.csv`);
          this.downloading.set(null);
        },
        error: () => this.downloading.set(null),
      });
  }

  private periodOf() {
    const raw = this.form.getRawValue();
    return {
      from: raw.from ? new Date(raw.from).toISOString() : undefined,
      to: raw.to ? new Date(`${raw.to}T23:59:59`).toISOString() : undefined,
    };
  }

  private release(): void {
    const old = this.fileLink();
    if (old) {
      URL.revokeObjectURL(old);
    }
  }
}

function dayText(when: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');
  return `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())}`;
}

function formatDateLabel(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return isoDate;
}

function formatVND(val: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(val)} VND`;
}

function formatVNDCompact(val: number): string {
  if (val >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1)} tr`;
  }
  if (val >= 1_000) {
    return `${(val / 1_000).toFixed(0)} k`;
  }
  return String(val);
}
