import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PaymentsService } from './payments.service';

function makeService(paymentQrImageUrl = '/img/payment-qr.png') {
  const orders = {
    findOwned: async () => ({
      orderCode: 'PM261014001',
      reference: 'PM261014001',
      total: { toString: () => '750000' },
      currency: 'VND',
      status: 'AWAITING_PAYMENT',
    }),
  };
  const config = {
    get: async () => ({
      bankName: 'Vietcombank',
      accountNumber: '0071000888888',
      accountHolder: 'PETMORY DEMO',
      paymentQrImageUrl,
    }),
  };
  return new PaymentsService(orders as never, config as never);
}

describe('PaymentsService.getQrCode', () => {
  it('returns the configured static QR and never changes the order status', async () => {
    const result = await makeService().getQrCode('PM261014001', 'customer-1');

    expect(result).toMatchObject({
      orderCode: 'PM261014001',
      transferMessage: 'PM261014001',
      amount: '750000',
      qrImageUrl: '/img/payment-qr.png',
      status: 'AWAITING_PAYMENT',
    });
  });

  it('fails closed when the manager has not supplied a static QR image', async () => {
    await expect(makeService('').getQrCode('PM261014001', 'customer-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
