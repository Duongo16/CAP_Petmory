export type Role = 'MANAGER' | 'ADMIN' | 'SUPPORT' | 'CUSTOMER';

/** Mot tai khoan, nhin tu man hinh quan ly tai khoan. */
export interface Account {
  _id: string;
  email: string;
  fullName: string;
  phone: string | null;
  roles: Role[];
  active: boolean;
  lastLoginAt: string | null;
  petProfileLimit: number | null;
  createdAt: string;
}

/** Mot trang danh sach tai khoan. */
export interface AccountPage {
  rows: Account[];
  total: number;
  page: number;
  pageCount: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  /** Missing on sessions saved before pictures were sent with the sign-in. */
  avatarUrl?: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type PetStatus = 'TOGETHER' | 'PASSED_AWAY';
export type Gender = 'MALE' | 'FEMALE' | 'UNKNOWN';

/** The kinds of pet the workshop makes a piece for. */
export type PetKind = 'DOG' | 'CAT' | 'RABBIT' | 'HAMSTER' | 'BIRD' | 'OTHER';

/** Someone at home who looks after the pet, and what they do for it. */
export interface Carer {
  name: string;
  role: string;
}

export interface Pet {
  _id: string;
  name: string;
  kind: PetKind;
  breed: string;
  gender: Gender;
  birthDate: string | null;
  status: PetStatus;
  passedAwayDate: string | null;
  avatarUrl: string;
  createdAt: string;
  /** A short line in the owner's own words, shown under the name. */
  tagline: string;
  /** The day the pet came home, which is often not the day it was born. */
  adoptionDate: string | null;
  microchip: string;
  neutered: boolean;
  trait: string[];
  carer: Carer[];
  /** Cach trinh chieu quyen nhat ky cua be nay. */
  slideSetting: { trackCode: string; effect: string; seconds: number };
  /** Quyen nhat ky cua be nay co cho nguoi ngoai doc khong. */
  diaryPublic: boolean;
  /** Quan tri vien da an quyen nay khoi cong dong hay chua. */
  diaryBlocked: boolean;
  diaryBlockReason: string;
}

/** What a remembered moment is about. Nothing here touches health records. */
export type MemoryTopic =
  | 'FIRST_DAY'
  | 'BIRTHDAY'
  | 'OUTING'
  | 'FUNNY'
  | 'LEARNING'
  | 'EVERYDAY';

/**
 * Mot mon do dat len trang so: o chu, buc anh, hoac hinh trang tri.
 *
 * Vi tri ghi theo phan tram cua trang, de trang bay ra man hinh nao hay in
 * ra giay kho nao thi moi thu van nam dung cho cu.
 */
export interface DecorItem {
  kind: 'TEXT' | 'PHOTO' | 'STICKER';
  x: number;
  y: number;
  width: number;
  rotate: number;
  z: number;
  text: string;
  photo: string | null;
  sticker: string;
  color: string;
  fontKey: string;
}

export interface Memory {
  _id: string;
  pet: string;
  title: string;
  body: string;
  happenedAt: string;
  place: string;
  topic: MemoryTopic;
  tag: string[];
  photo: string[];
  /** Cach bay tri trang so cho khoanh khac nay. Rong la trang chua bay tri. */
  decor: DecorItem[];
  /** Kieu giay cua trang. */
  paper: string;
  isMilestone: boolean;
  createdAt: string;
}

/** One page of a pet's diary, with the counts the filter chips need. */
export interface DiaryPage {
  rows: Memory[];
  total: number;
  page: number;
  pageCount: number;
  countByTopic: Partial<Record<MemoryTopic, number>>;
  /** How many of this pet's moments were marked worth remembering. */
  milestoneCount: number;
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

/** Mot dong tien trong bao cao, so nguyen dong viet duoi dang chuoi. */
export interface ReportMoneyRow {
  name: string;
  count: number;
  amount: string;
}

export interface DailyRevenueRow {
  date: string;
  orderCount: number;
  revenue: string;
}

/** Bao cao doanh thu trong mot khoang thoi gian. */
export interface RevenueReport {
  from: string;
  to: string;
  orderCount: number;
  total: string;
  byKind: ReportMoneyRow[];
  byProduct: ReportMoneyRow[];
  daily?: DailyRevenueRow[];
}

/** Mot loai luot dung tri tue nhan tao, kem so luot va chi phi. */
export interface AiCostRow {
  kind: string;
  count: number;
  cost: string;
}

export interface AiCostReport {
  from: string;
  to: string;
  total: string;
  rows: AiCostRow[];
}

/** Bao cao tien do san xuat. */
export interface ProgressReport {
  from: string;
  to: string;
  byStatus: { status: string; count: number }[];
  lateCount: number;
  late: { orderCode: string; status: string; estimatedDelivery: string }[];
}

/** Hai dong hang cua cua hang, dung nhu ten may chu dung. */
export type LineKind = 'MADE_TO_ORDER' | 'READY_MADE';

/** Mot nhom hang co san. */
export interface GoodsCategory {
  _id: string;
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  enabled: boolean;
}

/** Mot to hop bien the cua mot mon hang co san. */
export interface GoodsVariant {
  sku: string;
  optionValues: string[];
  price: Money;
  stock: number;
  enabled: boolean;
}

/** Mot mon hang co san. */
export interface Goods {
  _id: string;
  code: string;
  name: string;
  category: GoodsCategory | string;
  description: string;
  images: string[];
  optionNames: string[];
  variant: GoodsVariant[];
  deliveryDays: number;
  enabled: boolean;
}

/** Mot trang cua danh muc hang co san. */
export interface GoodsPage {
  rows: Goods[];
  total: number;
  page: number;
  pageCount: number;
}

/** Mot lan ton kho thay doi. */
export interface StockMove {
  _id: string;
  sku: string;
  delta: number;
  before: number;
  after: number;
  reason: 'MANUAL' | 'ORDER_PAID' | 'ORDER_CANCELLED';
  note: string;
  actor: { fullName: string } | null;
  orderCode: string;
  createdAt: string;
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
  /** Phu kien gan len mau, chot luc them vao gio. */
  accessories?: AccessoryLine[];
  /** Dong hang tuy bien hay dong hang co san. */
  kind: LineKind;
  /** Ma mon hang co san. Rong voi dong hang tuy bien. */
  goodsCode: string;
  sku: string;
  imageUrl: string;
  productTypeCode: string;
  sizeCode: string;
  displayName: string;
  petName: string;
  displayBaseCode: string;
  displayBaseName: string;
  /** Ban thiet ke gan voi dong hang tuy bien, rong voi hang co san. */
  designId: string | null;
  design: CartDesign | null;
  quantity: number;
  /** Unit price as an integer string in dong, because a number type would drift. */
  unitPrice: string;
  currency: string;
  productionDays: number;
}

/** Ban tom tat ban thiet ke cua mot dong hang. */
export interface CartDesign {
  id: string;
  name: string;
  modelCode: string;
  /** Goc anh xem truoc nen hien, rong khi chua co anh. */
  previewAngle: string;
  updatedAt: string | null;
  /** Ban thiet ke da bi xoa. */
  missing: boolean;
}

/** Mot quyen nhat ky tren man kiem duyet cong dong. */
export interface DiaryModerationCard {
  petId: string;
  name: string;
  kind: string;
  tagline: string;
  avatarUrl: string;
  momentCount: number;
  lastMomentAt: string | null;
  ownerName: string;
  diaryPublic: boolean;
  diaryBlocked: boolean;
  blockReason: string;
  blockedAt: string | null;
}

export interface DiaryModerationPage {
  rows: DiaryModerationCard[];
  total: number;
  page: number;
  pageCount: number;
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
  | 'PAID'
  | 'IN_PRODUCTION'
  | 'SHIPPING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderLine {
  /** Hang lam theo yeu cau hay hang co san trong kho. */
  kind?: 'MADE_TO_ORDER' | 'READY_MADE';
  goodsCode?: string;
  sku?: string;
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

/** Mot muc tren phieu kiem tra chat luong cua don. */
/**
 * Mot tai khoan mau de dang nhap nhanh khi dang lam o may ca nhan.
 *
 * May chu that khong tra ve tai khoan nao, nen danh sach nay rong o ban dung
 * that va man hinh dang nhap khong hien nut nao.
 */
export interface DemoAccount {
  email: string;
  password: string;
  labelKey: string;
  roles: string[];
}

/** Mot quyen nhat ky nhin tu ben ngoai, da bo het du lieu dinh danh. */
export interface DiaryCard {
  petId: string;
  name: string;
  kind: string;
  tagline: string;
  avatarUrl: string;
  momentCount: number;
  lastMomentAt: string | null;
  ownerName: string;
  ownerId: string;
  ownerAvatarUrl: string;
  slide: { trackCode: string; effect: string; seconds: number };
}

/** Giong van cua cau chuyen AI, trung danh sach phia may chu. */
export type StoryTone = 'WARM' | 'PLAYFUL' | 'TENDER' | 'SHORT';

/** Mot ban cau chuyen ve mot be. Moi lan viet lai la mot ban moi. */
export interface PetStory {
  _id: string;
  pet: string;
  title: string;
  content: string;
  tone: StoryTone;
  notes: string;
  /** LIVE la ban do dich vu that viet, SAMPLE la ban ghep tu ho so. */
  mode: 'LIVE' | 'SAMPLE' | 'LOCAL';
  /** MACHINE la ban may viet, PERSON la ban chu da sua tay. */
  hand: 'MACHINE' | 'PERSON';
  version: number;
  attachedMemory: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mot ban nhac trong kho cua he thong, do Ben A cung cap kem ban quyen. */
export interface MusicTrack {
  code: string;
  title: string;
  url: string;
  credit?: string;
}

/** Mot trang cua danh sach cac quyen dang de cong khai. */
export interface DiaryList {
  rows: DiaryCard[];
  total: number;
  page: number;
  pageCount: number;
}

/** Toan bo mot quyen nhat ky cho nguoi doc, kem anh cua cac khoanh khac. */
export interface DiaryBook {
  pet: DiaryCard;
  moments: Memory[];
  photo: PetPhoto[];
}

/** Mot duong dan chia se dang mo. Ma nguyen van khong nam trong day. */
export interface DiaryShare {
  _id: string;
  pet: string;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
}

/** Mot lan xuat quyen nhat ky ra tep. */
export type ExportState = 'PENDING' | 'READY' | 'FAILED' | 'EXPIRED';

export interface DiaryExport {
  _id: string;
  pet: string;
  state: ExportState;
  fromDate: string | null;
  toDate: string | null;
  byteSize: number;
  momentCount: number;
  problem: string;
  expiresAt: string;
  createdAt: string;
}

/** Gioi han ve kich thuoc anh, lay tu tham so nghiep vu. */
export interface PhotoRules {
  goodShortEdgePx: number;
  warnShortEdgePx: number;
  maxPhotoSizeMb: number;
}

export interface QualityTick {
  label: string;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
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
  /** Phieu kiem tra chat luong, lap khi don buoc vao khau kiem dinh. */
  qualityCheck: QualityTick[];
  /** Don can nguoi that xu ly, vi du hang khong con du hay tien ve cho don da huy. */
  needsAttention?: boolean;
  attentionNote?: string;
  reasonDestroy?: string;
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
  /** Da qua han thanh toan ma don van dang cho tien. */
  expired: boolean;
  status: OrderStatus;
}

export type PhotoAngle =
  | 'GENERAL'
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
  /** Null while a restored picture has not been attached to any pet yet. */
  pet: string | null;
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

/** Mot luot noi trong phien hoi thoai. */
export interface ChatTurn {
  side: 'USER' | 'BOT' | 'STAFF';
  text: string;
  suggestion: string[];
  path: string;
  productCode: string[];
  goodsCode: string[];
  at: string;
}

/** Bon buoc mot phien hoi thoai co the o. */
export type ChatState = 'BOT' | 'WAITING' | 'WITH_STAFF' | 'CLOSED';

/** Mot phien hoi thoai ban day du. */
export interface ChatSession {
  _id: string;
  code: string;
  owner: { _id: string; fullName: string; email: string } | string | null;
  state: ChatState;
  staff: { _id: string; fullName: string } | string | null;
  turn: ChatTurn[];
  lastAt: string;
  handoverNote: string;
}

/** Mot phong cach mau nguoi dung chon truoc khi xin goi y thiet ke. */
export interface SuggestStyleChoice {
  key: string;
  note: string;
}

/** Mot phuong an thiet ke do may de xuat. */
export interface SuggestOption {
  key: string;
  title: string;
  rationale: string;
  modelCode: string;
  zonePaint: ZonePaint[];
}

/** Mot lan xin goi y thiet ke, kem cac phuong an nhan duoc. */
export interface DesignSuggestion {
  _id: string;
  code: string;
  pet: string;
  style: string;
  mode: 'LIVE' | 'SAMPLE';
  option: SuggestOption[];
  chosenKey: string;
  appliedDesign: string | null;
  createdAt: string;
}

/** Han muc con lai cua mot chuc nang dung tri tue nhan tao. */
export interface QuotaLeft {
  day: number;
  month: number;
  year: number;
  /** So luot con lai. So am nghia la khong dat gioi han. */
  left: number;
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

export type ReconcileResult =
  | 'MATCHED'
  | 'OVERPAID'
  | 'UNDERPAID'
  | 'LATE'
  | 'NO_REFERENCE'
  | 'IGNORED'
  | 'ALREADY_PROCESSED';

export interface TransferNotification {
  _id: string;
  transactionId: string;
  amount: string;
  transferMessage: string;
  detectedReference: string;
  result: ReconcileResult;
  /** Bao qua webhook hay lay ve khi doi soat. */
  source?: 'WEBHOOK' | 'RECONCILE';
  gateway?: string;
  referenceCode?: string;
  createdAt: string;
}

/** Tom tat mot lan doi soat voi SePay. */
export interface ReconcileSummary {
  sinceDate: string;
  fetched: number;
  alreadyKnown: number;
  added: number;
  skipped: number;
  byResult: Partial<Record<ReconcileResult, number>>;
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

/** Don gia mot luot cho tung chuc nang dung tri tue nhan tao. */
export interface AiUnitPrice {
  restorePhoto: Money;
  designSuggestion: Money;
  storyWriting: Money;
  chatReply: Money;
}

/** Cung bon muc don gia do, nhung viet duoi dang chuoi de gui len may chu. */
export interface AiUnitPriceInput {
  restorePhoto: string;
  designSuggestion: string;
  storyWriting: string;
  chatReply: string;
}

export interface BusinessConfig {
  defaultPetProfileLimit: number;
  qrExpiryHours: number;
  estimatedShippingDays: number;
  goodShortEdgePx: number;
  warnShortEdgePx: number;
  maxPhotoSizeMb: number;
  /**
   * Han muc so luot cho tung chuc nang dung tri tue nhan tao.
   *
   * Bon chuc nang deu co mat. Dat bang khong o cho nao thi cho do khong gioi han.
   */
  aiQuota: {
    restorePhoto: PeriodQuota;
    designSuggestion?: PeriodQuota;
    storyWriting?: PeriodQuota;
    chatReply?: PeriodQuota;
  };
  aiUnitPrice: AiUnitPrice;
  qcChecklist: string[];
  /** Kho nhac trinh chieu nhat ky (muc 19). */
  musicLibrary?: MusicTrack[];
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  lastEditedBy: string | null;
}

export type UpdateBusinessConfig = Omit<
  BusinessConfig,
  'lastEditedBy' | 'aiUnitPrice'
> & {
  aiUnitPrice: AiUnitPriceInput;
};

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
  accessories?: string[];
  paint: MeshPaint[];
  colorCodesUsed: string[];
  /**
   * Mau tung vung co ten.
   *
   * Rong voi cac ban thiet ke cu. Ban sinh tu mot phuong an goi y chi co muc
   * nay chu chua co mau tung mat luoi.
   */
  zonePaint?: ZonePaint[];
  productTypeCode: string;
  sizeCode: string;
  engraving: Engraving;
  /** De trung bay; vang mat o cac ban thiet ke cu. */
  stand?: DesignStand;
  preview: DesignPreview[];
  pet: string | null;
  updatedAt: string;
}

/** De trung bay cua ban thiet ke: ma de trong danh muc, mau go va do trang tri. */
export interface DesignStand {
  baseCode: string;
  tone: string;
  decorations: string[];
}

/** Mau cua mot vung co ten tren mo hinh. */
export interface ZonePaint {
  zone: string;
  colorCode: string;
}

export interface SaveDesign {
  name: string;
  modelCode: string;
  accessories?: string[];
  paint?: MeshPaint[];
  colorCodesUsed?: string[];
  /** Mau tung vung co ten, de ho so san xuat ghi ma mau theo vung. */
  zonePaint?: ZonePaint[];
  productTypeCode?: string;
  sizeCode?: string;
  engraving?: { name?: string; memorialDate?: string; message?: string };
  stand?: DesignStand;
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
  /** Tung khoan cua gia, deu do may chu tinh: kich co, de, phu kien va tong. */
  sizePrice: string;
  standPrice: string;
  accessoryPrice: string;
  totalPrice: string;
  maxAccessories: number;
}

/** Diem neo tren mau nen ma phu kien gan vao. */
export type AccessoryAnchor = 'HEAD' | 'FACE' | 'NECK' | 'BACK';

/** Mot phu kien dung chung trong danh muc. */
export interface Accessory {
  _id: string;
  code: string;
  displayName: string;
  description: string;
  anchor: AccessoryAnchor;
  modelFile: string;
  priceDelta: Money;
  currency: string;
  imageUrl: string;
  enabled: boolean;
  sortOrder: number;
}

/** Mot phu kien tren dong hang, chot ten va gia. */
export interface AccessoryLine {
  code: string;
  displayName: string;
  priceDelta: string;
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
  /** Ma mau theo tung vung co ten, de xuong pha len dung cho. */
  zoneColours: { zone: string; wool: WoolRoll }[];
  engraving: Engraving | null;
  /** De trung bay cua mon nay, rong khi khong co de. */
  stand: { baseName: string; tone: string; decorations: string[] } | null;
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
