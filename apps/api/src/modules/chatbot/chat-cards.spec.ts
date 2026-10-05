import { describe, expect, it } from 'vitest';
import { cardsFor } from './chat-session.service';

const shop = {
  kinds: [
    { code: 'PT-01', name: 'Tượng len chọc' },
    { code: 'PT-02', name: 'Móc khóa len' },
  ],
  goods: [
    { code: 'G-BAT-AN', name: 'Bát ăn gốm men tím' },
    { code: 'G-VONG-LEN', name: 'Vòng cổ len chọc thủ công' },
  ],
};

describe('the product cards sent with a basic answer', () => {
  it('names the product mentioned in the answer', () => {
    const got = cardsFor('Tượng len chọc có ba kích cỡ...', '', shop);
    expect(got.productCode).toEqual(['PT-01']);
  });

  it('keeps the product the conversation is about, first', () => {
    const got = cardsFor('Móc khóa len giá từ 150.000 VND', 'PT-01', shop);
    expect(got.productCode).toEqual(['PT-01', 'PT-02']);
  });

  it('offers ready-made goods named in the question or answer', () => {
    const got = cardsFor('shop có bán bát ăn gốm men tím không', '', shop);
    expect(got.goodsCode).toEqual(['G-BAT-AN']);
  });

  it('sends no card when nothing in the shop is named', () => {
    const got = cardsFor('bé nhà mình bị ốm uống thuốc gì', '', shop);
    expect(got).toEqual({ productCode: [], goodsCode: [] });
  });
});
