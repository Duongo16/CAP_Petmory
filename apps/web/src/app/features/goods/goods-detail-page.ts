import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { take } from 'rxjs';
import { GoodsService } from '../../core/services/goods.service';
import { CartService } from '../../core/services/cart.service';
import { Goods, GoodsVariant } from '../../core/models/api.model';
import { MoneyPipe } from '../../shared/money.pipe';
import { Icon } from '../../shared/icon/icon';

type ScreenState = 'LOADING' | 'MISSING' | 'DONE';

/** Nhieu nhat bao nhieu mon mua duoc trong mot lan. */
const QUANTITY_MAX = 99;

/**
 * Mot mon hang co san.
 *
 * Luong mua o day la luong rut gon theo muc 23 khoan 17: khong tai anh, khong
 * qua buoc tuy bien, chi chon to hop roi bo vao gio.
 */
@Component({
  selector: 'pm-goods-detail-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, MoneyPipe, Icon],
  templateUrl: './goods-detail-page.html',
  styleUrl: './goods-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoodsDetailPage implements OnInit {
  /** Which item to show. */
  readonly code = input.required<string>();

  /** Shown inside the shop popup, where the back link has nowhere to lead. */
  readonly inPopup = input(false);

  private readonly service = inject(GoodsService);
  private readonly cart = inject(CartService);
  private readonly words = inject(TranslateService);
  private readonly notice = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ScreenState>('LOADING');
  readonly goods = signal<Goods | null>(null);
  readonly chosenSku = signal('');
  readonly quantity = signal(1);
  readonly shot = signal(0);
  readonly sending = signal(false);
  readonly problem = signal<string | null>(null);

  readonly limit = QUANTITY_MAX;

  /** Cac to hop dang ban, kem nhan doc duoc cua tung to hop. */
  readonly variants = computed(() =>
    (this.goods()?.variant ?? [])
      .filter((one) => one.enabled)
      .map((one) => ({
        raw: one,
        label: one.optionValues.filter(Boolean).join(' · '),
        soldOut: one.stock <= 0,
      })),
  );

  readonly chosen = computed<GoodsVariant | null>(
    () => this.variants().find((one) => one.raw.sku === this.chosenSku())?.raw ?? null,
  );

  readonly price = computed(() => this.chosen()?.price.$numberDecimal ?? '');

  readonly left = computed(() => this.chosen()?.stock ?? 0);

  readonly soldOut = computed(() => this.left() <= 0);

  /** Toan bo mon hang het sach hang thi khong con gi de chon. */
  readonly allGone = computed(() => this.variants().every((one) => one.soldOut));

  readonly images = computed(() => this.goods()?.images ?? []);

  readonly total = computed(() => {
    const each = Number(this.price());
    return Number.isFinite(each) ? String(each * this.quantity()) : '';
  });

  ngOnInit(): void {
    const code = this.code();
    this.service
      .detail(code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (one) => {
          this.goods.set(one);
          const first = one.variant.find((each) => each.enabled && each.stock > 0)
            ?? one.variant.find((each) => each.enabled);
          this.chosenSku.set(first?.sku ?? '');
          this.status.set('DONE');
        },
        error: () => this.status.set('MISSING'),
      });
  }

  choose(sku: string): void {
    this.chosenSku.set(sku);
    this.quantity.set(1);
    this.problem.set(null);
  }

  showShot(at: number): void {
    this.shot.set(at);
  }

  changeQuantity(step: number): void {
    const next = this.quantity() + step;
    this.quantity.set(Math.min(QUANTITY_MAX, Math.max(1, Math.min(next, this.left() || 1))));
  }

  /**
   * Bo mon dang chon vao gio.
   *
   * Ton kho khong bi tru o buoc nay. May chu chi tru khi don da thanh toan,
   * nen o day chi can bao loi neu may chu tu choi vi hang da het.
   */
  addToCart(): void {
    const one = this.chosen();
    if (!one || this.sending() || this.soldOut()) {
      return;
    }
    this.sending.set(true);
    this.problem.set(null);
    this.cart
      .addGoods(this.goods()?.code ?? '', one.sku, this.quantity())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.say('GOODS.ADDED');
        },
        error: (e: { status?: number }) => {
          this.sending.set(false);
          this.problem.set(e.status === 400 ? 'GOODS.NOT_ENOUGH' : 'COMMON.GENERIC_ERROR');
        },
      });
  }

  /** Bao mot dong ngan cho nguoi dung, da dich san. */
  private say(key: string): void {
    this.words
      .get(key)
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((line) => this.notice.open(line, '', { duration: 2600 }));
  }
}
