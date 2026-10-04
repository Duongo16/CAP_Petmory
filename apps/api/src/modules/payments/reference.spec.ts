import { describe, expect, it } from 'vitest';
import { candidateReferences, wholeDong } from './reference';

describe('candidateReferences', () => {
  it('finds a plain order code in the transfer message', () => {
    expect(candidateReferences('CT DEN PM261004001 thanh toan')).toEqual(['PM261004001']);
  });

  it('is not fooled by lower case or missing spaces', () => {
    expect(candidateReferences('ctden pm261004001ft2610')).toEqual(['PM261004001']);
  });

  it('tries the four digit daily sequence before the three digit one', () => {
    expect(candidateReferences('PM2610041000')).toEqual(['PM2610041000', 'PM261004100']);
  });

  it('puts the SePay payment code first', () => {
    expect(candidateReferences('chuyen tien PM261004002', 'PM261004001')).toEqual(['PM261004001', 'PM261004002']);
  });

  it('returns nothing when there is no code', () => {
    expect(candidateReferences('chuyen tien an trua', null)).toEqual([]);
  });

  it('ignores a prefix followed by too few digits', () => {
    expect(candidateReferences('PM2610')).toEqual([]);
  });
});

describe('wholeDong', () => {
  it('reads whole numbers and the two decimal strings from the SePay API', () => {
    expect(wholeDong(750000)).toBe(750000n);
    expect(wholeDong('18067000.00')).toBe(18067000n);
  });

  it('refuses fractions, negatives and text', () => {
    expect(wholeDong(1000.5)).toBeNull();
    expect(wholeDong('1000.50')).toBeNull();
    expect(wholeDong(-5)).toBeNull();
    expect(wholeDong('abc')).toBeNull();
    expect(wholeDong(undefined)).toBeNull();
  });
});
