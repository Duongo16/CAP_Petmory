import { Pipe, PipeTransform } from '@angular/core';
import { Money } from '../core/models/api.model';

/**
 * Displays money received from the server. The server returns an exact decimal,
 * so this only reformats it for reading and never recomputes the value.
 */
@Pipe({ name: 'amount', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: Money | string | null | undefined, unit = 'VND'): string {
    if (value === null || value === undefined) {
      return '';
    }
    const str = typeof value === 'string' ? value : value.$numberDecimal;
    const count = Number(str);
    if (Number.isNaN(count)) {
      return str;
    }
    return `${new Intl.NumberFormat('vi-VN').format(count)} ${unit}`;
  }
}
