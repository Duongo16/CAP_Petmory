import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

/** Mot la thu can gui. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Gui thu qua SMTP.
 *
 * Chua cau hinh SMTP thi khong gui. O moi truong phat trien, noi dung thu
 * duoc ghi ra nhat ky de van thu duoc luong; o moi truong that thi khong, vi
 * thu thuong chua ma bi mat nhu duong dan dat lai mat khau.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('mail.host'));
  }

  /** Tra ve true khi da giao cho may chu thu. Khong bao gio nem loi ra ngoai. */
  async send(message: MailMessage): Promise<boolean> {
    if (!this.enabled) {
      if (this.config.get<string>('nodeEnv') !== 'production') {
        this.logger.log(`Chua cau hinh SMTP, thu gui toi ${message.to} chi ghi ra day:\n${message.text}`);
      } else {
        this.logger.error(`Chua cau hinh SMTP nen khong gui duoc thu "${message.subject}"`);
      }
      return false;
    }
    try {
      await this.transport().sendMail({
        from: this.config.get<string>('mail.from'),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return true;
    } catch (trouble) {
      const why = trouble instanceof Error ? trouble.message : String(trouble);
      this.logger.warn(`Gui thu "${message.subject}" that bai: ${why}`);
      return false;
    }
  }

  private transport(): Transporter {
    if (!this.transporter) {
      const timeout = this.config.get<number>('mail.timeoutMs') ?? 10000;
      const user = this.config.get<string>('mail.user');
      this.transporter = createTransport({
        host: this.config.get<string>('mail.host'),
        port: this.config.get<number>('mail.port'),
        secure: this.config.get<boolean>('mail.secure'),
        auth: user ? { user, pass: this.config.get<string>('mail.pass') } : undefined,
        connectionTimeout: timeout,
        greetingTimeout: timeout,
        socketTimeout: timeout,
      });
    }
    return this.transporter;
  }
}
