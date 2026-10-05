/**
 * Cac tai khoan mau de dang nhap nhanh khi dang lam o may ca nhan.
 *
 * Danh sach nay chi duoc tra ve khi may chu KHONG chay o che do that. O che
 * do that, duong hoi danh sach tra ve rong, nen ban dung that khong bao gio
 * co nut dang nhap nhanh va cung khong co mat khau nao di ra ngoai.
 *
 * Day khong phai bi mat: do la cac tai khoan do chinh lenh gieo du lieu mau
 * tao ra, va lenh do da noi ro phai doi mat khau truoc khi dung that.
 */

/** Mot tai khoan mau, kem ten hien cho nguoi dang thu. */
export interface DemoAccount {
  email: string;
  password: string;
  labelKey: string;
  roles: string[];
}

/** Mat khau chung cua cac tai khoan noi bo do lenh gieo du lieu tao ra. */
const PASSWORD_INTERNAL = 'Petmory@2026';

/** Mat khau cua tai khoan khach mau. */
const PASSWORD_CUSTOMER = 'Petmory@2026';

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'quanly@petmory.local',
    password: PASSWORD_INTERNAL,
    labelKey: 'AUTH.QUICK.MANAGER',
    roles: ['MANAGER'],
  },
  {
    email: 'cskh@petmory.local',
    password: PASSWORD_INTERNAL,
    labelKey: 'AUTH.QUICK.SUPPORT',
    roles: ['SUPPORT'],
  },
  {
    email: 'khachhang@petmory.local',
    password: PASSWORD_CUSTOMER,
    labelKey: 'AUTH.QUICK.CUSTOMER',
    roles: ['CUSTOMER'],
  },
];
