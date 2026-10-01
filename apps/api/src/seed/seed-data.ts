import { ColorGroup } from '../modules/catalog/schemas/color-code.schema';

export interface ColorInit {
  code: string;
  displayName: string;
  swatch: string;
  group: ColorGroup;
  note: string;
}

/** The thirty-two seed colour codes, per section 1.6 of the requirements. */
export const LIST_COLOR: ColorInit[] = [
  { code: 'WOOL-W01', displayName: 'Trắng tuyết', swatch: '#FFFFFF', group: ColorGroup.FUR, note: 'Poodle trắng, mèo trắng, vùng bụng và ức' },
  { code: 'WOOL-W02', displayName: 'Trắng ngà', swatch: '#F7F3E8', group: ColorGroup.FUR, note: 'Lông trắng ngả vàng theo tuổi' },
  { code: 'WOOL-W03', displayName: 'Kem nhạt', swatch: '#F2E3C6', group: ColorGroup.FUR, note: 'Golden nhạt, mèo Ba Tư kem' },
  { code: 'WOOL-W04', displayName: 'Be nhạt', swatch: '#E8D6B8', group: ColorGroup.FUR, note: 'Vùng chuyển màu, lòng bàn chân' },

  { code: 'WOOL-Y01', displayName: 'Vàng bơ', swatch: '#E5B95C', group: ColorGroup.FUR, note: 'Golden Retriever' },
  { code: 'WOOL-Y02', displayName: 'Vàng cam', swatch: '#D98B3A', group: ColorGroup.FUR, note: 'Corgi, Shiba, mèo vàng' },
  { code: 'WOOL-Y03', displayName: 'Nâu sữa', swatch: '#C79A6B', group: ColorGroup.FUR, note: 'Vùng lông nhạt trên nền nâu' },
  { code: 'WOOL-B01', displayName: 'Nâu nhạt', swatch: '#A9764B', group: ColorGroup.FUR, note: 'Chihuahua, mèo nâu nhạt' },
  { code: 'WOOL-B02', displayName: 'Nâu socola', swatch: '#6B4226', group: ColorGroup.FUR, note: 'Labrador nâu, mèo socola' },
  { code: 'WOOL-B03', displayName: 'Nâu đỏ', swatch: '#8C3B1E', group: ColorGroup.FUR, note: 'Dachshund, Irish Setter' },
  { code: 'WOOL-B04', displayName: 'Nâu đen', swatch: '#3E2A1C', group: ColorGroup.FUR, note: 'Vùng mõm và tai sẫm màu' },

  { code: 'WOOL-G01', displayName: 'Xám khói', swatch: '#B9BEC4', group: ColorGroup.FUR, note: 'Mèo Nga xanh, Husky vùng sáng' },
  { code: 'WOOL-G02', displayName: 'Xám tro', swatch: '#8A8F96', group: ColorGroup.FUR, note: 'Schnauzer, mèo xám' },
  { code: 'WOOL-G03', displayName: 'Xám đậm', swatch: '#585D63', group: ColorGroup.FUR, note: 'Vùng lưng sẫm' },
  { code: 'WOOL-K01', displayName: 'Đen tuyền', swatch: '#1B1B1B', group: ColorGroup.FUR, note: 'Mèo đen, Labrador đen' },
  { code: 'WOOL-K02', displayName: 'Đen ngả nâu', swatch: '#2B2119', group: ColorGroup.FUR, note: 'Rottweiler, Doberman' },

  { code: 'WOOL-O01', displayName: 'Cam đất', swatch: '#C96A2B', group: ColorGroup.FUR, note: 'Mèo mướp cam' },
  { code: 'WOOL-O02', displayName: 'Hung đỏ', swatch: '#A8431C', group: ColorGroup.FUR, note: 'Mèo hung, Pomeranian' },

  { code: 'WOOL-EY01', displayName: 'Nâu hổ phách', swatch: '#B87333', group: ColorGroup.EYES_NOSE, note: 'Màu mắt phổ biến nhất' },
  { code: 'WOOL-EY02', displayName: 'Xanh lá', swatch: '#4E8B57', group: ColorGroup.EYES_NOSE, note: 'Mắt mèo' },
  { code: 'WOOL-EY03', displayName: 'Xanh dương', swatch: '#4A7FB5', group: ColorGroup.EYES_NOSE, note: 'Husky, mèo mắt xanh' },
  { code: 'WOOL-EY04', displayName: 'Nâu sẫm', swatch: '#4A3222', group: ColorGroup.EYES_NOSE, note: 'Màu mắt chó phổ biến' },
  { code: 'WOOL-NS01', displayName: 'Đen mũi', swatch: '#141414', group: ColorGroup.EYES_NOSE, note: 'Mũi và gan bàn chân' },
  { code: 'WOOL-NS02', displayName: 'Hồng mũi', swatch: '#E8A5A5', group: ColorGroup.EYES_NOSE, note: 'Mũi hồng ở lông sáng' },

  { code: 'WOOL-AC01', displayName: 'Đỏ tươi', swatch: '#D62828', group: ColorGroup.ACCESSORY, note: '' },
  { code: 'WOOL-AC02', displayName: 'Hồng pastel', swatch: '#F2B5C4', group: ColorGroup.ACCESSORY, note: '' },
  { code: 'WOOL-AC03', displayName: 'Xanh dương', swatch: '#3A7BD5', group: ColorGroup.ACCESSORY, note: '' },
  { code: 'WOOL-AC04', displayName: 'Xanh mint', swatch: '#8FD9C0', group: ColorGroup.ACCESSORY, note: '' },
  { code: 'WOOL-AC05', displayName: 'Vàng chanh', swatch: '#F2D14E', group: ColorGroup.ACCESSORY, note: '' },
  { code: 'WOOL-AC06', displayName: 'Tím lavender', swatch: '#A98BD1', group: ColorGroup.ACCESSORY, note: '' },
  { code: 'WOOL-AC07', displayName: 'Xanh navy', swatch: '#1F3A64', group: ColorGroup.ACCESSORY, note: '' },
  { code: 'WOOL-AC08', displayName: 'Nâu da bò', swatch: '#8B5A2B', group: ColorGroup.ACCESSORY, note: '' },
];

export interface SeedSize {
  code: string;
  displayName: string;
  dimensions: string;
  explainer: string;
  price: string;
  productionDays: number;
  minPhotos: number;
  maxAccessories: number;
}

export interface ProductTypeInit {
  code: string;
  name: string;
  description: string;
  material: string;
  sortOrder: number;
  sizes: SeedSize[];
}

/**
 * Seed catalog, per section 1.5 of the requirements.
 * Prices and production days are demo data; the Manager group edits them on the
 * settings page before going live.
 */
export const PRODUCT_LIST: ProductTypeInit[] = [
  {
    code: 'PT-01',
    name: 'Tượng len chọc',
    description: 'Tượng toàn thân, sản phẩm chủ lực',
    material: 'Vải tái chế cao cấp',
    sortOrder: 1,
    sizes: [
      { code: 'FIG-S', displayName: 'Nhỏ', dimensions: 'Cao khoảng 8 cm', explainer: 'Vừa lòng bàn tay, hợp để bàn làm việc hoặc kệ nhỏ. Thể hiện được dáng, màu lông chủ đạo và một phụ kiện đơn giản. Các đốm lông nhỏ sẽ được giản lược.', price: '450000', productionDays: 7, minPhotos: 3, maxAccessories: 1 },
      { code: 'FIG-M', displayName: 'Vừa', dimensions: 'Cao khoảng 12 cm', explainer: 'Size được chọn nhiều nhất. Thể hiện rõ đặc điểm khuôn mặt, các mảng màu lông và đốm lớn, mang được hai tới ba phụ kiện.', price: '750000', productionDays: 10, minPhotos: 4, maxAccessories: 3 },
      { code: 'FIG-L', displayName: 'Lớn', dimensions: 'Cao khoảng 18 cm', explainer: 'Mức chi tiết cao nhất. Làm được vân lông nhiều lớp, các đốm nhỏ, biểu cảm mắt rõ, trang phục đầy đủ. Phù hợp làm kỷ vật trưng bày lâu dài.', price: '1250000', productionDays: 14, minPhotos: 4, maxAccessories: 5 },
    ],
  },
  {
    code: 'PT-02',
    name: 'Móc khóa len chọc',
    description: 'Quà nhỏ, mang theo hằng ngày',
    material: 'Vải tái chế cao cấp',
    sortOrder: 2,
    sizes: [
      { code: 'KEY-S', displayName: 'Một cỡ', dimensions: 'Khoảng 5 cm, phần đầu', explainer: 'Chỉ làm phần đầu, giữ lại những nét dễ nhận ra nhất: màu lông, dáng tai, mắt và mũi. Nhẹ, bền, mang theo được hằng ngày.', price: '250000', productionDays: 5, minPhotos: 2, maxAccessories: 1 },
    ],
  },
  {
    code: 'PT-03',
    name: 'Tranh len chọc nổi',
    description: 'Chân dung đắp nổi trong khung',
    material: 'Vải tái chế và khung gỗ',
    sortOrder: 3,
    sizes: [
      { code: 'POR-S', displayName: 'Nhỏ', dimensions: 'Khung 15 x 15 cm', explainer: 'Chân dung cận mặt một bé. Tập trung vào khuôn mặt và ánh mắt.', price: '650000', productionDays: 8, minPhotos: 2, maxAccessories: 1 },
      { code: 'POR-M', displayName: 'Vừa', dimensions: 'Khung 20 x 20 cm', explainer: 'Chân dung nửa thân một bé, có nền đơn giản.', price: '950000', productionDays: 11, minPhotos: 3, maxAccessories: 2 },
      { code: 'POR-L', displayName: 'Lớn', dimensions: 'Khung 25 x 25 cm', explainer: 'Làm được một tới hai bé, toàn thân, nền có chi tiết. Treo tường như một bức tranh thật.', price: '1450000', productionDays: 15, minPhotos: 4, maxAccessories: 3 },
    ],
  },
  {
    code: 'PT-04',
    name: 'Bộ nhiều bé',
    description: 'Nhiều thú cưng chung một đế',
    material: 'Vải tái chế cao cấp',
    sortOrder: 4,
    sizes: [
      { code: 'SET-2', displayName: 'Hai bé', dimensions: 'Hai bé trên một đế', explainer: 'Mỗi bé chọn size riêng. Giá bằng tổng giá từng bé cộng phụ phí đế chung.', price: '1600000', productionDays: 18, minPhotos: 8, maxAccessories: 4 },
      { code: 'SET-3', displayName: 'Ba bé', dimensions: 'Ba bé trên một đế', explainer: 'Mỗi bé chọn size riêng, cùng đặt trên một đế gỗ chung.', price: '2350000', productionDays: 24, minPhotos: 12, maxAccessories: 6 },
    ],
  },
  {
    code: 'PT-05',
    name: 'Hộp trưng bày kỷ niệm',
    description: 'Tượng, đế khắc chữ và hộp kính',
    material: 'Vải tái chế, gỗ và kính',
    sortOrder: 5,
    sizes: [
      { code: 'BOX-M', displayName: 'Vừa', dimensions: 'Tượng size vừa trong hộp kính', explainer: 'Kèm đế khắc tên và ngày tháng. Dành cho nhu cầu tưởng nhớ, giữ sản phẩm sạch bụi lâu dài.', price: '1150000', productionDays: 14, minPhotos: 4, maxAccessories: 3 },
      { code: 'BOX-L', displayName: 'Lớn', dimensions: 'Tượng size lớn trong hộp kính', explainer: 'Như trên, mức chi tiết cao nhất, phù hợp làm kỷ vật lâu dài.', price: '1750000', productionDays: 18, minPhotos: 4, maxAccessories: 5 },
    ],
  },
];

/** A stand the figure is mounted on, per the product page in the design. */
export interface SeedDisplayBase {
  code: string;
  displayName: string;
  description: string;
  priceDelta: string;
  sortOrder: number;
}

/** Seed stands. The Manager edits the prices on the settings page before going live. */
export const DISPLAY_BASE_LIST: SeedDisplayBase[] = [
  { code: 'BASE-NONE', displayName: 'Không đế', description: 'Chỉ riêng tượng, không kèm đế trưng bày.', priceDelta: '0', sortOrder: 0 },
  { code: 'BASE-ROUND', displayName: 'Gỗ tròn', description: 'Đế gỗ tròn đánh bóng, hợp đặt bàn làm việc.', priceDelta: '120000', sortOrder: 1 },
  { code: 'BASE-SQUARE', displayName: 'Gỗ vuông', description: 'Đế gỗ vuông khắc được tên và ngày tháng.', priceDelta: '150000', sortOrder: 2 },
];
