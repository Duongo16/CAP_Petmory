import { Attribute, ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';

/** Date field displayed consistently as dd/mm/yyyy (and optionally time). */
@Component({
  selector: 'pm-date-input',
  standalone: true,
  template: `
    <input
      class="tw-input w-full"
      [id]="id"
      type="text"
      [value]="display"
      [placeholder]="dateTime() ? 'dd/mm/yyyy HH:mm' : 'dd/mm/yyyy'"
      inputmode="numeric"
      autocomplete="off"
      [disabled]="disabled"
      [attr.aria-invalid]="invalid"
      (input)="onInput($event)"
      (blur)="onBlur()"
    />
  `,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInput), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateInput), multi: true },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateInput implements ControlValueAccessor, Validator {
  constructor(@Attribute('id') readonly id: string | null) {}
  readonly dateTime = input(false);
  display = '';
  disabled = false;
  invalid = false;

  private value = '';
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  writeValue(value: unknown): void {
    this.value = typeof value === 'string' ? value : '';
    this.display = this.format(this.value);
    this.invalid = false;
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  validate(_control: AbstractControl): ValidationErrors | null {
    return this.invalid ? { dateFormat: true } : null;
  }

  onInput(event: Event): void {
    this.display = (event.target as HTMLInputElement).value;
    const parsed = this.parse(this.display);
    this.invalid = this.display.trim() !== '' && parsed === null;
    if (parsed !== null) {
      this.value = parsed;
      this.onChange(parsed);
    } else if (this.display.trim() === '') {
      this.value = '';
      this.onChange('');
    }
    this.onValidatorChange();
  }

  onBlur(): void {
    this.onTouched();
    const parsed = this.parse(this.display);
    if (parsed !== null) {
      this.value = parsed;
      this.display = this.format(parsed);
      this.invalid = false;
    }
    this.onValidatorChange();
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
    if (!this.dateTime()) return `${year.toString().padStart(4, '0')}-${match[2]}-${match[1]}`;
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    if (hour > 23 || minute > 59) return null;
    return new Date(year, month - 1, day, hour, minute).toISOString();
  }
}
