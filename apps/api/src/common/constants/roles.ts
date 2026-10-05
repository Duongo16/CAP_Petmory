/**
 * Cac nhom quyen.
 *
 * PETMORY dung o giua: viec dat mo hinh va dat hang chi can ghi nhan ket qua
 * va doi trang thai, nen bo may khong can nhieu tang quyen. Cac nhom la:
 *
 * - Quan ly: toan bo phan van hanh va quan ly tai khoan, kiem duyet, nhat ky.
 *   Nhom Quan tri vien rieng da gop vao day.
 * - Cham soc khach hang: truc hoi thoai, xem don va khach.
 * - Khach hang: nguoi mua.
 *
 * Luu y ve hop dong: Phu luc 01 muc 1 ghi bon nhom quyen. Gop nhom Quan tri
 * vien vao nhom Quan ly lech voi cho do va can Ben A ky nhan.
 */
export enum Role {
  MANAGER = 'MANAGER',
  /** Cham soc khach hang: truc hoi thoai, xem don va khach, khong sua gi. */
  SUPPORT = 'SUPPORT',
  CUSTOMER = 'CUSTOMER',
}

/** Cac nhom duoc tinh la nguoi cua PETMORY. */
export const INTERNAL: Role[] = [Role.MANAGER, Role.SUPPORT];

/** Nhung nhom duoc xem don, khach hang va truc hoi thoai. */
export const DESK: Role[] = [Role.MANAGER, Role.SUPPORT];

export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';
