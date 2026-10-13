import { ConflictException, Injectable } from '@nestjs/common';
import { BusinessConfigService } from '../business-config/business-config.service';
import { OrdersService } from '../orders/orders.service';

/** Thong tin chuyen khoan hien cho khach sau khi dat don. */
export interface PaymentQr {
  orderCode: string;
  reference: string;
  amount: string;
  currency: string;
  transferMessage: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  /** Anh QR dung do cua cua hang cau hinh, khong ma hoa theo tung don. */
  qrImageUrl: string;
  status: string;
}

/**
 * Cung cap huong dan thanh toan bang QR tinh.
 *
 * He thong khong goi cong thanh toan, khong nhan webhook va khong tu chuyen
 * trang thai don. Nhan vien kiem tra giao dich thuc te va chuyen trang thai
 * tren don hang; thay doi nay van di qua state machine va nhat ky thao tac.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly orders: OrdersService,
    private readonly config: BusinessConfigService,
  ) {}

  async getQrCode(orderCode: string, customer: string): Promise<PaymentQr> {
    const order = await this.orders.findOwned(orderCode, customer);
    const config = await this.config.get();

    if (!config.paymentQrImageUrl) {
      throw new ConflictException('Chua cau hinh anh QR thanh toan tinh');
    }

    return {
      orderCode: order.orderCode,
      reference: order.reference,
      amount: order.total.toString().split('.')[0],
      currency: order.currency,
      transferMessage: order.reference,
      bankName: config.bankName,
      accountNumber: config.accountNumber,
      accountHolder: config.accountHolder,
      qrImageUrl: config.paymentQrImageUrl,
      status: order.status,
    };
  }
}
