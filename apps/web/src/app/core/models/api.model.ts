export type Role = 'MANAGER' | 'ADMIN' | 'SUPPORT' | 'CUSTOMER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type PetStatus = 'TOGETHER' | 'PASSED_AWAY';
export type Gender = 'MALE' | 'FEMALE' | 'UNKNOWN';

export interface Pet {
  _id: string;
  name: string;
  kind: string;
  breed: string;
  gender: Gender;
  birthDate: string | null;
  status: PetStatus;
  passedAwayDate: string | null;
  avatarUrl: string;
  createdAt: string;
}

export type ColorGroup = 'FUR' | 'EYES_NOSE' | 'ACCESSORY';

export interface ColorCode {
  _id: string;
  code: string;
  displayName: string;
  swatch: string;
  group: ColorGroup;
  note: string;
  enabled: boolean;
}

/** Money from the server arrives as an exact decimal, not a floating point number. */
export interface Money {
  $numberDecimal: string;
}

export interface ProductSize {
  _id: string;
  code: string;
  displayName: string;
  dimensions: string;
  explainer: string;
  price: Money;
  currency: string;
  productionDays: number;
  minPhotos: number;
  maxAccessories: number;
  enabled: boolean;
}

/** The rolled-up rating shown on a product card and on the detail page. */
export interface RatingSummary {
  average: number;
  count: number;
}

export interface ProductType {
  _id: string;
  code: string;
  name: string;
  description: string;
  material: string;
  imageUrl: string;
  sizes: ProductSize[];
  enabled: boolean;
  rating: RatingSummary;
}

/** A stand the finished figure is mounted on. */
export interface DisplayBase {
  _id: string;
  code: string;
  displayName: string;
  description: string;
  priceDelta: { $numberDecimal: string };
  currency: string;
}

export interface ProductReview {
  id: string;
  rating: number;
  comment: string;
  authorName: string;
  createdAt: string;
}

/** A product the signed-in customer is still entitled to rate. */
export interface PendingReview {
  productTypeCode: string;
  orderCode: string;
}

export interface CartLine {
  id: string;
  productTypeCode: string;
  sizeCode: string;
  displayName: string;
  petName: string;
  displayBaseCode: string;
  displayBaseName: string;
  quantity: number;
  /** Unit price as an integer string in dong; a number type would introduce drift. */
  unitPrice: string;
  currency: string;
  productionDays: number;
}

export interface Cart {
  items: CartLine[];
  countItem: number;
  total: string;
  currency: string;
  productionDaysMax: number;
}

export interface ApiError {
  success: false;
  traceId: string;
  status: number;
  message: string | string[];
  path: string;
  timestamp: string;
}

export type OrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_EXPIRED'
  | 'PAID'
  | 'IN_PRODUCTION'
  | 'QUALITY_CHECK'
  | 'READY_TO_SHIP'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderLine {
  productTypeCode: string;
  sizeCode: string;
  displayName: string;
  petName: string;
  quantity: number;
  unitPrice: Money;
  productionDays: number;
}

export interface DeliveryInfo {
  fullName: string;
  phone: string;
  address: string;
  province: string;
  note: string;
}

export interface Order {
  _id: string;
  orderCode: string;
  reference: string;
  rows: OrderLine[];
  delivery: DeliveryInfo;
  total: Money;
  currency: string;
  status: OrderStatus;
  productionDays: number;
  estimatedDelivery: string;
  paymentDeadline: string;
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentQr {
  orderCode: string;
  reference: string;
  amount: string;
  currency: string;
  transferMessage: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  qrImage: string;
  paymentDeadline: string;
  status: OrderStatus;
}

export type PhotoAngle =
  | 'FRONT'
  | 'LEFT_SIDE'
  | 'RIGHT_SIDE'
  | 'BACK'
  | 'FACE_CLOSEUP'
  | 'FAVOURITE_POSE';

export type QualityLabel = 'GOOD' | 'ACCEPTABLE' | 'SHOULD_RESTORE' | 'UNUSABLE';

export interface QualityScore {
  width: number;
  height: number;
  shortEdge: number;
  sharpness: number;
  brightness: number;
  label: QualityLabel;
  warning: string[];
}

export interface PetPhoto {
  _id: string;
  pet: string;
  angle: PhotoAngle;
  originalName: string;
  fileType: string;
  fileSize: number;
  quality: QualityScore;
  /** Only set on a restored version: how closely it still resembles the original. */
  resemblance: number | null;
  originalPhoto: string | null;
  isRestored: boolean;
  confirmedByOwner: boolean;
  createdAt: string;
}

export interface AngleCheckResult {
  missing: PhotoAngle[];
  rawAngle: boolean;
  countPhoto: number;
}

export type RestoreOperation =
  | 'UPSCALE'
  | 'SHARPEN'
  | 'DENOISE'
  | 'EXPOSURE'
  | 'CONTRAST';

export interface AssistantAnswer {
  code: string;
  content: string;
  suggestion: string[];
  path: string | null;
  understood: boolean;
}

export interface PageResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CustomerSummary {
  _id: string;
  email: string;
  fullName: string;
  roles: Role[];
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CustomerRow extends CustomerSummary {
  countOrder: number;
}

export interface Actor {
  _id: string;
  fullName: string;
  email: string;
}

export interface AuditEntry {
  _id: string;
  actor: Actor | null;
  action: string;
  resourceType: string;
  resourceId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string;
  createdAt: string;
}

export interface AdminOrderDetail {
  order: Order;
  customer: CustomerSummary | null;
  nextSteps: OrderStatus[];
  history: AuditEntry[];
}

export interface CustomerProfile {
  customer: CustomerSummary;
  pet: Pet[];
  orders: Order[];
}

export type ReconcileResult = 'MATCHED' | 'NO_REFERENCE' | 'UNDERPAID' | 'ALREADY_PROCESSED';

export interface TransferNotification {
  _id: string;
  transactionId: string;
  amount: string;
  transferMessage: string;
  detectedReference: string;
  result: ReconcileResult;
  createdAt: string;
}

export interface OrderFilter {
  status?: OrderStatus | '';
  keyword?: string;
  page?: number;
}

export interface PeriodQuota {
  day: number;
  month: number;
  year: number;
}

export interface BusinessConfig {
  defaultPetProfileLimit: number;
  qrExpiryHours: number;
  estimatedShippingDays: number;
  goodShortEdgePx: number;
  warnShortEdgePx: number;
  maxPhotoSizeMb: number;
  aiQuota: { restorePhoto: PeriodQuota };
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  lastEditedBy: string | null;
}

export type UpdateBusinessConfig = Omit<BusinessConfig, 'lastEditedBy'>;

export type PreviewAngle = 'FRONT' | 'LEFT' | 'RIGHT' | 'BACK' | 'TOP' | 'ISO';

export interface MeshPaint {
  mesh: string;
  color: string;
}

export interface Engraving {
  name: string;
  memorialDate: string | null;
  message: string;
}

export interface DesignPreview {
  angle: PreviewAngle;
  fileName: string;
}

export interface Design {
  _id: string;
  name: string;
  modelCode: string;
  paint: MeshPaint[];
  colorCodesUsed: string[];
  productTypeCode: string;
  sizeCode: string;
  engraving: Engraving;
  preview: DesignPreview[];
  pet: string | null;
  updatedAt: string;
}

export interface SaveDesign {
  name: string;
  modelCode: string;
  paint?: MeshPaint[];
  colorCodesUsed?: string[];
  productTypeCode?: string;
  sizeCode?: string;
  engraving?: { name?: string; memorialDate?: string; message?: string };
  pet?: string;
}

export interface Quote {
  productTypeCode: string;
  nameProductType: string;
  sizeCode: string;
  sizeName: string;
  dimensions: string;
  unitPrice: string;
  currency: string;
  productionDays: number;
  minPhotos: number;
}

export interface WoolRoll {
  code: string;
  displayName: string;
  swatch: string;
}

export interface ProductionItem {
  displayName: string;
  quantity: number;
  petName: string;
  modelCode: string | null;
  nameDesign: string | null;
  designId: string | null;
  woolRolls: WoolRoll[];
  engraving: Engraving | null;
  anglesPreview: PreviewAngle[];
  productionDays: number;
}

export interface ReferencedPhoto {
  code: string;
  angle: string;
  isRestored: boolean;
  confirmedByOwner: boolean;
  labelQuality: QualityLabel;
}

export interface ProductionFile {
  orderCode: string;
  status: OrderStatus;
  orderedAt: string;
  estimatedDelivery: string;
  productionDays: number;
  delivery: DeliveryInfo;
  items: ProductionItem[];
  petPhoto: ReferencedPhoto[];
  missing: string[];
}
