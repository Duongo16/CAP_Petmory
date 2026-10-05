import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

/** Bo loc khi doc nhat ky thao tac. */
export interface AuditSearch {
  resourceType?: string;
  action?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
  page?: number;
}

/** So dong moi trang khi doc nhat ky. */
const AUDIT_PAGE_SIZE = 30;

function escapeText(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface WriteAuditInput {
  actor?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  reason?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private readonly model: Model<AuditLogDocument>,
  ) {}

  async write(input: WriteAuditInput): Promise<void> {
    await this.model.create({
      actor: input.actor ? new Types.ObjectId(input.actor) : null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? '',
      before: this.normalize(input.before),
      after: this.normalize(input.after),
      ipAddress: input.ipAddress ?? '',
      reason: input.reason ?? '',
    });
  }

  /**
   * Read back the activity history of one resource, newest first.
   * Read only: audit entries are never updated or deleted.
   */
  historyOfResource(resourceType: string, resourceId: string, limit = 50) {
    return this.model
      .find({ resourceType, resourceId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .populate('actor', 'fullName email')
      .exec();
  }

  /**
   * Tim trong nhat ky thao tac (muc 14), moi nhat truoc, co phan trang.
   * Chi doc: nhat ky khong bao gio bi sua hay xoa.
   */
  async search(filter: AuditSearch) {
    const where: Record<string, unknown> = {};
    if (filter.resourceType) {
      where.resourceType = filter.resourceType;
    }
    if (filter.action) {
      where.action = filter.action;
    }
    const id = filter.resourceId?.trim();
    if (id) {
      where.resourceId = new RegExp(escapeText(id), 'i');
    }
    if (filter.from || filter.to) {
      where.createdAt = { ...(filter.from ? { $gte: filter.from } : {}), ...(filter.to ? { $lte: filter.to } : {}) };
    }
    const page = Math.max(filter.page ?? 1, 1);
    const [rows, total] = await Promise.all([
      this.model
        .find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * AUDIT_PAGE_SIZE)
        .limit(AUDIT_PAGE_SIZE)
        .populate('actor', 'fullName email')
        .exec(),
      this.model.countDocuments(where).exec(),
    ]);
    return { rows, total, page, pageSize: AUDIT_PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
  }

  /** Cac loai tai nguyen va hanh dong da co trong nhat ky, de man hinh loc chon tu danh sach. */
  async facets(): Promise<{ resourceType: string[]; action: string[] }> {
    const [resourceType, action] = await Promise.all([
      this.model.distinct('resourceType').exec(),
      this.model.distinct('action').exec(),
    ]);
    return { resourceType: (resourceType as string[]).sort(), action: (action as string[]).sort() };
  }

  /** Flatten a record into a plain object before storing it in the audit log. */
  private normalize(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) {
      return null;
    }
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }
}
