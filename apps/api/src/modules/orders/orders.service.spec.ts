import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service';
import { OrderStatus } from './schemas/order.schema';

function makeService() {
  const order = {
    _id: 'order-1',
    orderCode: 'PM261014001',
    customer: { toString: () => 'customer-1' },
    status: OrderStatus.AWAITING_PAYMENT,
    rows: [],
    qualityCheck: [],
    paidAt: null,
  };
  const update = vi.fn((where: { status: OrderStatus }, change: { $set: Record<string, unknown> }) => ({
    exec: async () => {
      if (order.status !== where.status) return null;
      Object.assign(order, change.$set);
      return order;
    },
  }));
  const model = {
    findOne: () => ({ exec: async () => order }),
    findOneAndUpdate: update,
    findById: () => ({ exec: async () => order }),
  };
  const audit = { write: vi.fn(async () => undefined) };
  const service = new OrdersService(
    model as never, {} as never, {} as never, {} as never,
    audit as never, {} as never, {} as never,
  );
  return { service, order, update, audit };
}

describe('customer transfer confirmation', () => {
  it('records the customer declaration without marking payment received', async () => {
    const { service, order, update, audit } = makeService();
    const result = await service.confirmTransferMine(order.orderCode, 'customer-1');
    expect(result.status).toBe(OrderStatus.TRANSFER_CONFIRMED);
    expect(result.paidAt).toBeNull();
    expect(update.mock.calls[0][1].$set).toEqual({ status: OrderStatus.TRANSFER_CONFIRMED });
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'customer-1',
      before: { status: OrderStatus.AWAITING_PAYMENT },
      after: { status: OrderStatus.TRANSFER_CONFIRMED },
    }));
  });

  it('rejects a different customer and a repeated declaration', async () => {
    const { service, order } = makeService();
    await expect(service.confirmTransferMine(order.orderCode, 'customer-2')).rejects.toBeInstanceOf(NotFoundException);
    await service.confirmTransferMine(order.orderCode, 'customer-1');
    await expect(service.confirmTransferMine(order.orderCode, 'customer-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires the customer declaration before staff can mark the order paid', async () => {
    const { service, order } = makeService();
    await expect(service.transitionStatus(order as never, OrderStatus.PAID, 'staff-1', 'Bank checked'))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
