/**
 * Ba nhom quyen.
 *
 * PETMORY dung o giua: viec dat mo hinh va dat hang chi can ghi nhan ket qua
 * va doi trang thai, nen bo may khong can nhieu tang quyen. Ba nhom la:
 *
 * - Quan ly: san pham, don hang, vat lieu, tham so, bao cao, kho hang, truc
 *   hoi thoai. Toan bo phan van hanh.
 * - Quan tri vien: chi quan ly tai khoan. Khong cham vao don hang hay tien.
 * - Khach hang: nguoi mua.
 *
 * Luu y ve hop dong: Phu luc 01 muc 1 ghi bon nhom quyen, gom ca nhom Cham soc
 * khach hang. Ban rut xuong ba nhom nay lech voi cho do va can Ben A ky nhan.
 */
export enum Role {
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

/** Cac nhom duoc tinh la nguoi cua PETMORY. */
export const INTERNAL: Role[] = [Role.MANAGER, Role.ADMIN];

export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';
