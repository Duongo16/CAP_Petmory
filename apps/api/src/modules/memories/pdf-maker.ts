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
  evaluate(work: () => Promise<unknown>): Promise<unknown>;
  pdf(options: {
    format: string;
    printBackground: boolean;
    margin: { top: string; bottom: string; left: string; right: string };
  }): Promise<Buffer>;
}

interface BrowserMaker {
  chromium: { launch(options?: { executablePath?: string; args?: string[] }): Promise<HeadlessBrowser> };
}

/** Ban Chromium thu gon cho nen tang chay theo tung yeu cau. */
interface ServerlessChromium {
  args: string[];
  executablePath(input?: string): Promise<string>;
}

/**
 * Goi Chromium tai ve luc chay, khop phien ban goi da cai.
 *
 * Tai ve thu muc tam cua ham thay vi dong goi kem, de goi ham khong phinh
 * them va khong phu thuoc cach nen tang chon tep dong goi. Dat bien moi
 * truong de tro sang ban luu o noi khac neu can.
 */
const CHROMIUM_PACK =
  process.env.CHROMIUM_PACK_URL ??
  'https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar';

/**
 * Mo trinh duyet de in.
 *
 * May chu thuong dung bo trinh duyet cua du an. Tren Vercel khong co trinh
 * duyet nao cai san, nen dung ban Chromium thu gon di kem goi cai dat.
 */
async function openBrowser(): Promise<HeadlessBrowser> {
  if (process.env.VERCEL) {
    const core = require('playwright-core') as unknown as BrowserMaker;
    const lite = require('@sparticuz/chromium') as { default?: ServerlessChromium } & ServerlessChromium;
    const chrome = lite.default ?? lite;
    return core.chromium.launch({ executablePath: await chrome.executablePath(CHROMIUM_PACK), args: chrome.args });
  }
  const tool = require('playwright') as unknown as BrowserMaker;
  return tool.chromium.launch();
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
    const browser = await openBrowser();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      // Cho phong chu tieng Viet tai xong roi moi in, de chu co dau khong bi vo.
      await page.evaluate(() => document.fonts.ready);
      return await page.pdf({ format: 'A4', printBackground: true, margin: MARGIN });
    } finally {
      await browser.close().catch((trouble: Error) => {
        this.logger.warn(`Khong dong duoc trinh duyet: ${trouble.message}`);
      });
    }
  }
}
