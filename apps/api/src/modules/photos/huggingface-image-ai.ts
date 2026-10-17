import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InferenceClient,
  type InferenceProviderOrPolicy,
  PROVIDERS_OR_POLICIES,
} from '@huggingface/inference';

/** Ket qua sua anh tu mot provider ben ngoai. */
export interface HuggingFaceImageAiAnswer {
  data: Buffer | null;
  problem: string;
  /** Giữ cùng hợp đồng với Cloudinary; HF hiện không phát mã quota riêng. */
  warning?: 'CLOUDINARY_QUOTA';
}

const BREAK_AFTER = 3;
const BREAK_MS = 60_000;

/**
 * Goi Hugging Face Inference Providers tu Backend.
 *
 * Token khong bao gio duoc dua xuong browser. Model va provider nam trong env
 * de co the doi model ma khong phai sua code. Anh chi ton tai trong bo nho cua
 * process va duoc tra ve duoi dang bytes, khong luu them ban sao tren HF.
 */
@Injectable()
export class HuggingFaceImageAi {
  private readonly log = new Logger(HuggingFaceImageAi.name);
  private readonly token: string;
  private readonly model: string;
  private readonly provider: InferenceProviderOrPolicy;
  private readonly endpointUrl: string;
  private readonly timeoutMs: number;
  private readonly client: InferenceClient | null;
  private failInRow = 0;
  private openUntil = 0;

  constructor(config: ConfigService) {
    const token = config.get<string>('ai.huggingface.token') ?? '';
    const model = config.get<string>('ai.huggingface.imageModel') ?? '';
    const wantedProvider =
      config.get<string>('ai.huggingface.provider') ?? 'auto';
    this.token = token;
    this.model = model;
    this.provider = PROVIDERS_OR_POLICIES.includes(
      wantedProvider as InferenceProviderOrPolicy,
    )
      ? (wantedProvider as InferenceProviderOrPolicy)
      : 'auto';
    this.endpointUrl = config.get<string>('ai.huggingface.endpointUrl') ?? '';
    this.timeoutMs = config.get<number>('ai.timeoutMs') ?? 45_000;
    this.client = this.ready
      ? new InferenceClient(
          token,
          this.endpointUrl ? { endpointUrl: this.endpointUrl } : {},
        )
      : null;
  }

  get ready(): boolean {
    return Boolean(this.token && this.model);
  }

  async edit(
    data: Buffer,
    operations: string[],
  ): Promise<HuggingFaceImageAiAnswer> {
    if (!this.ready || !this.client) {
      return {
        data: null,
        problem: 'Chua cau hinh HF_TOKEN hoac HF_IMAGE_MODEL',
      };
    }
    if (Date.now() < this.openUntil) {
      return {
        data: null,
        problem: 'Hugging Face dang tam ngat sau nhieu lan goi hong',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const result = await this.client.imageToImage(
        {
          model: this.model,
          provider: this.provider,
          inputs: new Blob([Uint8Array.from(data)], { type: 'image/png' }),
          parameters: { prompt: promptFor(operations) },
        },
        { signal: controller.signal },
      );
      const output = Buffer.from(await result.arrayBuffer());
      if (!output.length) {
        throw new Error('Hugging Face khong tra ve anh');
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
      this.log.warn(`Goi Hugging Face khong thanh cong: ${why}`);
      return { data: null, problem: why };
    } finally {
      clearTimeout(timer);
    }
  }
}

function promptFor(operations: string[]): string {
  const instructions: string[] = [
    'Restore this pet photo while preserving the exact pet identity.',
    'Keep the same species, breed, body shape, pose, fur colors, fur pattern, eyes, nose, markings, and expression.',
    'Remove blur and compression noise and recover natural detail without inventing new features.',
    'Do not turn the pet into a human, cartoon, different breed, or different animal.',
  ];
  if (operations.includes('REMOVE_BACKGROUND')) {
    instructions.push(
      'Replace only the background with a plain pure white background; keep the pet unchanged.',
    );
  }
  return instructions.join(' ');
}

function shortReason(trouble: unknown): string {
  if (trouble instanceof Error) {
    return trouble.message.replace(/\s+/g, ' ').slice(0, 200);
  }
  return 'Loi khong ro tu Hugging Face';
}
