import {
  Attribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Icon } from '../icon/icon';

/** Mot o ngay trong luoi lich. */
interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  chosen: boolean;
  blocked: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * Date field displayed consistently as dd/mm/yyyy (and optionally time).
 *
 * Bat [calendar] thi o van go tay duoc, kem nut mo bang lich tu dung theo mau
 * cua giao dien (chon thang, nam, ngay; phim mui ten di chuyen, Enter chon, Esc
 * dong). [max]/[min] (yyyy-mm-dd) chan ngay ngoai khoang ca khi go lan khi chon.
 * Gia tri luon la yyyy-mm-dd.
 */
@Component({
  selector: 'pm-date-input',
  // id chuyen xuong o nhap ben trong; bo khoi the bao de nhan (label for) tro dung o va khong trung id.
  host: { '[attr.id]': 'null' },
  standalone: true,
  imports: [Icon, TranslatePipe],
  templateUrl: './date-input.html',
  styleUrl: './date-input.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInput), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateInput), multi: true },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateInput implements ControlValueAccessor, Validator {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);

  constructor(@Attribute('id') readonly id: string | null) {}

  readonly dateTime = input(false);
  /** Them nut mo bang lich ben canh o go tay. */
  readonly calendar = input(false);
  /** Ngay xa nhat duoc chon (yyyy-mm-dd), vi du hom nay de khong chon ngay chua toi. */
  readonly max = input('');
  readonly min = input('');

  display = '';
  disabled = false;
  invalid = false;

  private value = '';
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  /* ---------- Bang lich ---------- */

  readonly open = signal(false);
  /** Thang dang xem (nam, thang 0-11) va o dang tro bang ban phim. */
  readonly viewYear = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth());
  readonly focusIso = signal('');
  private readonly chosenIso = signal('');
  /** Vi tri bang lich tren man hinh (co dinh, de khong bi hop thoai cat mat). */
  readonly panelPos = signal<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });

  private readonly locale = computed(() => (this.translate.currentLang === 'en' ? 'en-GB' : 'vi-VN'));

  /** Ten thu, bat dau tu thu Hai. */
  readonly weekdays = computed(() =>
    this.translate.currentLang === 'en'
      ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
      : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
  );

  readonly monthNames = computed(() => {
    const fmt = new Intl.DateTimeFormat(this.locale(), { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2024, i, 1)));
  });

  /** Cac nam trong khoang min..max (mac dinh 40 nam ve truoc den nam nay). */
  readonly years = computed(() => {
    const now = new Date().getFullYear();
    const top = this.max() ? Number(this.max().slice(0, 4)) : now + 5;
    const bottom = this.min() ? Number(this.min().slice(0, 4)) : now - 40;
    return Array.from({ length: top - bottom + 1 }, (_, i) => top - i);
  });

  readonly cells = computed<DayCell[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;
    const todayIso = this.todayIso();
    const chosen = this.chosenIso();
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(year, month, 1 - lead + i);
      const iso = isoOf(date.getFullYear(), date.getMonth(), date.getDate());
      return {
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        today: iso === todayIso,
        chosen: iso === chosen,
        blocked: this.outOfRange(iso),
      };
    });
  });

  readonly canPrev = computed(() => !this.min() || isoOf(this.viewYear(), this.viewMonth(), 1) > this.min());
  readonly canNext = computed(() => {
    const y = this.viewMonth() === 11 ? this.viewYear() + 1 : this.viewYear();
    const m = (this.viewMonth() + 1) % 12;
    return !this.max() || isoOf(y, m, 1) <= this.max();
  });

  /* ---------- Form ---------- */

  writeValue(value: unknown): void {
    this.value = typeof value === 'string' ? value : '';
    this.display = this.format(this.value);
    this.chosenIso.set(this.value.slice(0, 10));
    this.invalid = false;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.cdr.markForCheck();
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    return this.invalid ? { dateFormat: true } : null;
  }

  onInput(event: Event): void {
    this.display = (event.target as HTMLInputElement).value;
    const parsed = this.parse(this.display);
    this.invalid = this.display.trim() !== '' && parsed === null;
    if (parsed !== null) {
      this.commit(parsed, false);
    } else if (this.display.trim() === '') {
      this.commit('', false);
    }
    this.onValidatorChange();
  }

  onBlur(): void {
    this.onTouched();
    const parsed = this.parse(this.display);
    if (parsed !== null) {
      this.commit(parsed, true);
      this.invalid = false;
    }
    this.onValidatorChange();
  }

  /* ---------- Thao tac lich ---------- */

  toggle(): void {
    if (this.open()) {
      this.close(false);
      return;
    }
    const start = this.chosenIso() || this.clamp(this.todayIso());
    const [y, m] = start.split('-').map(Number);
    this.viewYear.set(y);
    this.viewMonth.set(m - 1);
    this.focusIso.set(start);
    this.place();
    this.open.set(true);
    setTimeout(() => this.focusDay());
  }

  close(returnFocus = true): void {
    this.open.set(false);
    if (returnFocus) {
      this.host.nativeElement.querySelector<HTMLInputElement>('input.date-text')?.focus();
    }
  }

  shiftMonth(by: number): void {
    const date = new Date(this.viewYear(), this.viewMonth() + by, 1);
    this.viewYear.set(date.getFullYear());
    this.viewMonth.set(date.getMonth());
  }

  setMonth(event: Event): void {
    this.viewMonth.set(Number((event.target as HTMLSelectElement).value));
  }

  setYear(event: Event): void {
    this.viewYear.set(Number((event.target as HTMLSelectElement).value));
  }

  choose(cell: DayCell): void {
    if (cell.blocked) {
      return;
    }
    this.invalid = false;
    this.commit(cell.iso, true);
    this.onTouched();
    this.onValidatorChange();
    this.close();
  }

  pickToday(): void {
    const today = this.todayIso();
    if (!this.outOfRange(today)) {
      this.choose({ iso: today, day: 0, inMonth: true, today: true, chosen: false, blocked: false });
    }
  }

  clear(): void {
    this.invalid = false;
    this.commit('', true);
    this.onValidatorChange();
    this.close();
  }

  /** Mui ten di chuyen theo ngay/tuan, PageUp/PageDown theo thang, Enter chon. */
  onGridKey(event: KeyboardEvent): void {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const [y, m, d] = (this.focusIso() || this.todayIso()).split('-').map(Number);
    let next: Date | null = null;
    if (event.key in step) {
      next = new Date(y, m - 1, d + step[event.key]);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      next = new Date(y, m - 1 + (event.key === 'PageUp' ? -1 : 1), d);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const cell = this.cells().find((one) => one.iso === this.focusIso());
      if (cell) {
        this.choose(cell);
      }
      return;
    }
    if (!next) {
      return;
    }
    event.preventDefault();
    const iso = isoOf(next.getFullYear(), next.getMonth(), next.getDate());
    this.focusIso.set(iso);
    this.viewYear.set(next.getFullYear());
    this.viewMonth.set(next.getMonth());
    setTimeout(() => this.focusDay());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onOutside(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onMove(): void {
    if (this.open()) {
      this.place();
    }
  }

  /* ---------- Noi bo ---------- */

  private commit(iso: string, reformat: boolean): void {
    this.value = iso;
    this.chosenIso.set(iso);
    if (reformat) {
      this.display = this.format(iso);
    }
    this.onChange(iso);
    this.cdr.markForCheck();
  }

  /** Dat bang lich duoi o nhap, het cho phia duoi thi lat len tren. */
  private place(): void {
    const box = this.host.nativeElement.getBoundingClientRect();
    const width = 300;
    const height = 360;
    const up = box.bottom + height > window.innerHeight && box.top > height;
    this.panelPos.set({
      top: up ? box.top - height - 6 : box.bottom + 6,
      left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)),
      up,
    });
  }

  private focusDay(): void {
    this.host.nativeElement.querySelector<HTMLButtonElement>(`.cal-day[data-iso="${this.focusIso()}"]`)?.focus();
  }

  private todayIso(): string {
    const now = new Date();
    return isoOf(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private outOfRange(iso: string): boolean {
    return (!!this.max() && iso > this.max()) || (!!this.min() && iso < this.min());
  }

  private clamp(iso: string): string {
    if (this.max() && iso > this.max()) return this.max();
    if (this.min() && iso < this.min()) return this.min();
    return iso;
  }

  private format(value: string): string {
    if (!value) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
    if (!match) return '';
    const base = `${match[3]}/${match[2]}/${match[1]}`;
    return this.dateTime() && match[4] ? `${base} ${match[4]}:${match[5]}` : base;
  }

  private parse(raw: string): string | null {
    const text = raw.trim();
    const pattern = this.dateTime()
      ? /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/
      : /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = pattern.exec(text);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    if (!this.dateTime()) {
      const iso = `${year.toString().padStart(4, '0')}-${match[2]}-${match[1]}`;
      return this.outOfRange(iso) ? null : iso;
    }
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    if (hour > 23 || minute > 59) return null;
    return new Date(year, month - 1, day, hour, minute).toISOString();
  }
}
