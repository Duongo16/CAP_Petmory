import { Injectable, Logger } from '@nestjs/common';

/**
 * Cai bien giua noi dung va tep in ra.
 *
 * Moi thu lien quan den cach dung tep PDF nam sau lop nay, nen doi cach dung
 * khong dung den mot dong nao cua nghiep vu nhat ky.
 */
export abstract class PdfMaker {
  abstract fromHtml(html: string): Promise<Buffer>;
}

/** Nhung gi lop nay can o bo cong cu trinh duyet, khong hon. */
interface HeadlessBrowser {
  newPage(): Promise<HeadlessPage>;
  close(): Promise<void>;
}

interface HeadlessPage {
  setContent(html: string, options: { waitUntil: 'load' }): Promise<void>;
  pdf(options: {
    format: string;
    printBackground: boolean;
    margin: { top: string; bottom: string; left: string; right: string };
  }): Promise<Buffer>;
}

interface BrowserMaker {
  chromium: { launch(): Promise<HeadlessBrowser> };
}

/** Le tep, dat rong de anh mot trang khong bi cat mat vien. */
const MARGIN = { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' };

/**
 * Dung tep in ra bang chinh bo dung trinh duyet co san trong du an.
 *
 * Cach nay duoc chon vi tieng Viet co dau: mot thu vien PDF thong thuong chi
 * in duoc bang chu khong dau tru khi nhung kem mot bo chu rieng, con trinh
 * duyet thi tu lo lieu phan do va nhung dung phan chu da dung.
 *
 * Bo cong cu chi duoc nap khi that su can in, de may chu van khoi dong duoc
 * o nhung noi khong cai bo cong cu nay.
 */
@Injectable()
export class BrowserPdfMaker extends PdfMaker {
  private readonly logger = new Logger(BrowserPdfMaker.name);

  async fromHtml(html: string): Promise<Buffer> {
    const tool = require('playwright') as unknown as BrowserMaker;
    const browser = await tool.chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      return await page.pdf({ format: 'A4', printBackground: true, margin: MARGIN });
    } finally {
      await browser.close().catch((trouble: Error) => {
        this.logger.warn(`Khong dong duoc trinh duyet: ${trouble.message}`);
      });
    }
  }
}
