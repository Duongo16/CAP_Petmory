import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

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

  /** Flatten a record into a plain object before storing it in the audit log. */
  private normalize(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) {
      return null;
    }
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }
}
