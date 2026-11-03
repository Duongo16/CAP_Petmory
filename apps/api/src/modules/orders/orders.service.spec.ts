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
    model as never, {} as never, {} as never, {} as never, {} as never,
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

describe('AR code for pet frame orders', () => {
  const frameRow = { kind: 'MADE_TO_ORDER', design: { modelCode: 'HEAD-DOG-SHIBA', engraving: { name: '' }, pet: null }, petName: '' };
  const readyRow = { kind: 'READY_MADE', design: null, petName: '' };

  function serviceWith(rows: unknown[], arCode = '') {
    const order = { _id: 'order-1', rows, arCode, status: OrderStatus.AWAITING_PAYMENT };
    const updateOne = vi.fn(() => ({ exec: async () => ({ modifiedCount: 1 }) }));
    const model = { updateOne };
    const service = new OrdersService(
      model as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never,
    );
    return { service, order, updateOne };
  }

  it('gives an older frame order a random code, written only if it still has none', async () => {
    const { service, order, updateOne } = serviceWith([frameRow]);
    await service.ensureArCode(order as never);
    expect(order.arCode).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect((updateOne.mock.calls[0] as unknown[])[0]).toEqual({ _id: 'order-1', arCode: { $in: ['', null] } });
  });

  it('leaves orders of ready-made goods and orders that already have a code alone', async () => {
    const ready = serviceWith([readyRow]);
    await ready.service.ensureArCode(ready.order as never);
    expect(ready.order.arCode).toBe('');
    const kept = serviceWith([frameRow], 'abcdefghijkl');
    await kept.service.ensureArCode(kept.order as never);
    expect(kept.order.arCode).toBe('abcdefghijkl');
    expect(ready.updateOne).not.toHaveBeenCalled();
    expect(kept.updateOne).not.toHaveBeenCalled();
  });

  it('refuses a malformed code without reading the database', async () => {
    const { service } = serviceWith([frameRow]);
    await expect(service.arView('short')).rejects.toBeInstanceOf(NotFoundException);
  });
});
