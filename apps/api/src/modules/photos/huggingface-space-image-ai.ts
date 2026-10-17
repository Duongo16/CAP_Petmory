import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Kết quả xử lý ảnh từ một Hugging Face Space công khai. */
export interface HuggingFaceSpaceImageAiAnswer {
  data: Buffer | null;
  problem: string;
}

const BREAK_AFTER = 3;
const BREAK_MS = 60_000;
const DEFAULT_SPACE = 'https://nick088-real-esrgan-pytorch.hf.space';
const DEFAULT_API_NAME = 'predict';
const DEFAULT_SCALE = 4;

/**
 * Gọi một Gradio Space công khai bằng HTTP.
 *
 * Space dùng hàng đợi Gradio: upload ảnh tạm thời, submit vào queue rồi đọc
 * luồng SSE đến khi nhận được URL ảnh đầu ra. Token HF không cần thiết với
 * Space công khai và không bao giờ được đưa xuống browser.
 */
@Injectable()
export class HuggingFaceSpaceImageAi {
  private readonly log = new Logger(HuggingFaceSpaceImageAi.name);
  private readonly baseUrl: string;
  private readonly apiName: string;
  private readonly scale: number;
  private readonly timeoutMs: number;
  private failInRow = 0;
  private openUntil = 0;

  constructor(config: ConfigService) {
    this.baseUrl = normalizeUrl(
      config.get<string>('ai.huggingface.spaceUrl') ?? DEFAULT_SPACE,
    );
    this.apiName = normalizeApiName(
      config.get<string>('ai.huggingface.spaceApiName') ?? DEFAULT_API_NAME,
    );
    this.scale = clampScale(
      config.get<number>('ai.huggingface.spaceScale') ?? DEFAULT_SCALE,
    );
    this.timeoutMs = Math.max(
      config.get<number>('ai.timeoutMs') ?? 45_000,
      120_000,
    );
  }

  get ready(): boolean {
    return Boolean(this.baseUrl && this.apiName);
  }

  async edit(
    data: Buffer,
    _operations: string[],
  ): Promise<HuggingFaceSpaceImageAiAnswer> {
    if (!this.ready) {
      return { data: null, problem: 'Chưa cấu hình HF_SPACE_URL' };
    }
    if (Date.now() < this.openUntil) {
      return {
        data: null,
        problem: 'Hugging Face Space đang tạm ngắt sau nhiều lần gọi hỏng',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const path = await this.upload(data, controller.signal);
      const eventId = await this.joinQueue(
        path,
        data.length,
        controller.signal,
      );
      const outputUrl = await this.readQueue(eventId, controller.signal);
      const output = await this.download(outputUrl, controller.signal);
      if (!output.length) {
        throw new Error('Hugging Face Space không trả về ảnh');
      }
      this.failInRow = 0;
      return { data: output, problem: '' };
    } catch (trouble) {
      this.failInRow += 1;
      if (this.failInRow >= BREAK_AFTER) {
        this.openUntil = Date.now() + BREAK_MS;
        this.failInRow = 0;
      }
      const why = shortReason(trouble);
      this.log.warn(`Gọi Hugging Face Space không thành công: ${why}`);
      return { data: null, problem: why };
    } finally {
      clearTimeout(timer);
    }
  }

  private async upload(data: Buffer, signal: AbortSignal): Promise<string> {
    const form = new FormData();
    form.append(
      'files',
      new Blob([Uint8Array.from(data)], { type: 'image/png' }),
      'restore.png',
    );
    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      body: form,
      signal,
    });
    if (!response.ok) {
      throw new Error(`Space upload HTTP ${response.status}`);
    }
    const payload = (await response.json()) as unknown;
    const path = Array.isArray(payload)
      ? payload[0]
      : typeof payload === 'object' && payload !== null && 'path' in payload
        ? (payload as { path?: unknown }).path
        : null;
    if (typeof path !== 'string' || !path) {
      throw new Error('Space không trả về đường dẫn upload');
    }
    return path;
  }

  private async joinQueue(
    path: string,
    size: number,
    signal: AbortSignal,
  ): Promise<string> {
    const sessionHash = randomId();
    const response = await fetch(`${this.baseUrl}/queue/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        data: [
          {
            path,
            url: null,
            size,
            orig_name: 'restore.png',
            mime_type: 'image/png',
            is_stream: false,
            meta: { _type: 'gradio.FileData' },
          },
          this.scale,
        ],
        event_data: null,
        fn_index: 0,
        trigger_id: 13,
        session_hash: sessionHash,
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`Space queue HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { event_id?: unknown };
    if (typeof payload.event_id !== 'string' || !payload.event_id) {
      throw new Error('Space không tạo được phiên xử lý');
    }
    return `${sessionHash}:${payload.event_id}`;
  }

  private async readQueue(event: string, signal: AbortSignal): Promise<string> {
    const [sessionHash, eventId] = event.split(':');
    const response = await fetch(
      `${this.baseUrl}/queue/data?session_hash=${encodeURIComponent(sessionHash)}`,
      { signal },
    );
    if (!response.ok || !response.body) {
      throw new Error(`Space queue data HTTP ${response.status}`);
    }
    const text = await response.text();
    const events = text
      .split(/\n\s*\n/)
      .flatMap((block) => block.split('\n'))
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .map((line) => parseJson(line))
      .filter((item): item is Record<string, unknown> => Boolean(item));
    const completed = events.find(
      (item) => item.msg === 'process_completed' && item.event_id === eventId,
    );
    if (completed?.success !== true) {
      throw new Error(
        completed?.msg === 'process_failed'
          ? 'Space xử lý ảnh thất bại'
          : 'Space không hoàn tất xử lý ảnh',
      );
    }
    const output = completed.output as { data?: unknown } | undefined;
    const first = Array.isArray(output?.data) ? output.data[0] : null;
    const url =
      typeof first === 'object' && first !== null && 'url' in first
        ? (first as { url?: unknown }).url
        : null;
    if (typeof url !== 'string' || !url) {
      throw new Error('Space không trả về URL ảnh');
    }
    return url;
  }

  private async download(url: string, signal: AbortSignal): Promise<Buffer> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Space output HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function normalizeApiName(value: string): string {
  return value.trim().replace(/^\//, '');
}

function clampScale(value: number): number {
  return Number.isFinite(value) && value >= 1 && value <= 4
    ? value
    : DEFAULT_SCALE;
}

function randomId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function parseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function shortReason(trouble: unknown): string {
  if (trouble instanceof Error) {
    return trouble.message.replace(/\s+/g, ' ').slice(0, 200);
  }
  return 'Lỗi không rõ từ Hugging Face Space';
}
