import { describe, expect, it } from 'vitest';
import { PaymentsService } from './payments.service';
import { ReconcileResult } from './schemas/payment-notification.schema';
import { OrderStatus } from '../orders/schemas/order.schema';
import type { SePayTransaction } from './sepay-client';

const SHOP_ACCOUNT = '0071000888888';

/** Mot don gia, chi du nhung truong dich vu thanh toan doc toi. */
function fakeOrder(reference: string, total: string) {
  return {
    orderCode: reference,
    reference,
    total: { toString: () => total },
    status: OrderStatus.AWAITING_PAYMENT,
    paymentDeadline: new Date(Date.now() + 3_600_000),
  };
}

/** Giao dich theo dung mau JSON trong tai lieu API giao dich cua SePay. */
function transaction(id: string, amountIn: string, content: string, amountOut = '0.00'): SePayTransaction {
  return {
    id,
    bank_brand_name: 'Vietcombank',
    account_number: SHOP_ACCOUNT,
    transaction_date: '2026-10-04 19:59:48',
    amount_out: amountOut,
    amount_in: amountIn,
    accumulated: '1200541768.00',
    transaction_content: content,
    reference_number: `677760.${id}`,
    code: null,
    sub_account: null,
  };
}

function build(transactions: SePayTransaction[]) {
  const orders = new Map([['PM261004001', fakeOrder('PM261004001', '750000')]]);
  const logged = new Map<string, Record<string, unknown>>();
  const moved: string[] = [];
  const flagged: string[] = [];
  const audits: unknown[] = [];

  const log = {
    create: async (row: Record<string, unknown>) => {
      const id = String(row['transactionId']);
      if (logged.has(id)) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      logged.set(id, row);
      return row;
    },
    updateOne: () => ({ exec: async () => undefined }),
  };
  const ordersService = {
    findByReference: async (code: string) => orders.get(code) ?? null,
    transitionStatus: async (order: { orderCode: string; status: OrderStatus }, to: OrderStatus) => {
      order.status = to;
      moved.push(order.orderCode);
    },
    flagForAttention: async (_order: unknown, note: string) => {
      flagged.push(note);
    },
  };
  const config = { get: async () => ({ accountNumber: SHOP_ACCOUNT, bankCode: '970436', bankName: 'VCB', accountHolder: 'PETMORY' }) };
  const sepay = { listTransactions: async () => transactions };
  const audit = { write: async (entry: unknown) => audits.push(entry) };

  const service = new PaymentsService(
    log as never,
    ordersService as never,
    config as never,
    sepay as never,
    audit as never,
  );
  return { service, logged, moved, flagged, audits, orders };
}

describe('PaymentsService.reconcile', () => {
  it('records missed incoming transfers, skips outgoing ones and pays the order', async () => {
    const { service, logged, moved, audits } = build([
      transaction('49682', '750000.00', 'NGUYEN VAN A chuyen tien PM261004001'),
      transaction('49683', '0.00', 'Rut tien', '200000.00'),
      transaction('49684', '18067000.00', 'chuyen tien an trua'),
    ]);

    const summary = await service.reconcile(2, '507f1f77bcf86cd799439011');

    expect(summary.fetched).toBe(3);
    expect(summary.skipped).toBe(1);
    expect(summary.added).toBe(2);
    expect(summary.byResult).toEqual({ [ReconcileResult.MATCHED]: 1, [ReconcileResult.NO_REFERENCE]: 1 });
    expect(moved).toEqual(['PM261004001']);
    expect(logged.get('49682')?.['source']).toBe('RECONCILE');
    expect(logged.get('49682')?.['amount']).toBe('750000');
    expect(audits).toHaveLength(1);
  });

  it('never records the same transaction twice when run again', async () => {
    const { service, moved } = build([transaction('49682', '750000.00', 'PM261004001')]);
    await service.reconcile(1, '507f1f77bcf86cd799439011');
    const again = await service.reconcile(1, '507f1f77bcf86cd799439011');

    expect(again.alreadyKnown).toBe(1);
    expect(again.added).toBe(0);
    expect(moved).toHaveLength(1);
  });

  it('skips an amount with a fraction instead of rounding it', async () => {
    const { service, logged } = build([transaction('49690', '750000.50', 'PM261004001')]);
    const summary = await service.reconcile(1, '507f1f77bcf86cd799439011');

    expect(summary.skipped).toBe(1);
    expect(logged.size).toBe(0);
  });
});

describe('PaymentsService.receiveNotification', () => {
  it('treats a webhook and a later reconciliation of the same transaction as one', async () => {
    const { service, moved } = build([transaction('92704', '750000.00', 'PM261004001')]);
    const answer = await service.receiveNotification({
      id: 92704,
      transferType: 'in',
      transferAmount: 750000,
      content: 'PM261004001 chuyen tien',
      accountNumber: SHOP_ACCOUNT,
    });
    const summary = await service.reconcile(1, '507f1f77bcf86cd799439011');

    expect(answer).toEqual({ success: true, result: ReconcileResult.MATCHED });
    expect(summary.alreadyKnown).toBe(1);
    expect(moved).toHaveLength(1);
  });

  it('flags an underpaid order without moving it', async () => {
    const { service, moved, flagged } = build([]);
    const answer = await service.receiveNotification({ id: 1, transferType: 'in', transferAmount: 500000, content: 'PM261004001' });

    expect(answer.result).toBe(ReconcileResult.UNDERPAID);
    expect(moved).toHaveLength(0);
    expect(flagged[0]).toContain('thieu');
  });
});
