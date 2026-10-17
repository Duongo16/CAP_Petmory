/** Custom keepsakes currently offered in the customer shop and Studio. */
export const FIGURE_PRODUCT_CODE = 'PT-01';
export const PORTRAIT_PRODUCT_CODE = 'PT-03';

export const CUSTOM_KEEPSAKE_CODES = new Set([FIGURE_PRODUCT_CODE, PORTRAIT_PRODUCT_CODE]);

/**
 * Bao bi chi hop voi mot loai san pham. Long mica trum len tuong nen chi cho tuong;
 * khung hop treo tuong dong khung tranh len noi nen chi cho tranh. Ma khong co o day
 * (cac loai hop) dung chung cho moi san pham.
 */
export const PACKAGING_ONLY_FOR: Record<string, string> = {
  'FRAME-ACRYLIC': FIGURE_PRODUCT_CODE,
  'FRAME-SHADOW': PORTRAIT_PRODUCT_CODE,
};

/** Bao bi nay co dung duoc cho san pham dang chon khong. */
export function packagingFits(packagingCode: string, productCode: string): boolean {
  const only = PACKAGING_ONLY_FOR[packagingCode];
  return !only || !productCode || only === productCode;
}
