import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/**
 * Append-only audit log: entries are never updated or deleted.
 * Covers every action touching orders, money or customer data.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  actor!: Types.ObjectId | null;

  @Prop({ required: true, trim: true, index: true })
  action!: string;

  @Prop({ required: true, trim: true, index: true })
  resourceType!: string;

  @Prop({ trim: true, default: '', index: true })
  resourceId!: string;

  @Prop({ type: Object, default: null })
  before!: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  after!: Record<string, unknown> | null;

  @Prop({ trim: true, default: '' })
  ipAddress!: string;

  @Prop({ trim: true, default: '' })
  reason!: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
