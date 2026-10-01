import { OrderStatus } from '../core/models/api.model';

/**
 * Translation key lookup for order statuses. Every key is declared explicitly so
 * it can be found in the source; keys are never built by string concatenation.
 */
export const KEY_STATUS_ORDER: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'ORDER.STATUS.AWAITING_PAYMENT',
  PAID: 'ORDER.STATUS.PAID',
  IN_PRODUCTION: 'ORDER.STATUS.IN_PRODUCTION',
  SHIPPING: 'ORDER.STATUS.SHIPPING',
  COMPLETED: 'ORDER.STATUS.COMPLETED',
  CANCELLED: 'ORDER.STATUS.CANCELLED',
};

/** Display order on the dispatch board, following an order's real life cycle. */
export const SORT_ORDER_STATUS: OrderStatus[] = [
  'AWAITING_PAYMENT',
  'PAID',
  'IN_PRODUCTION',
  'SHIPPING',
  'COMPLETED',
  'CANCELLED',
];

/**
 * The colour group for each status. Group names are used instead of colour values
 * so the actual colours stay in the stylesheet.
 */
export const GROUP_COLOR_STATUS: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'awaiting',
  PAID: 'good',
  IN_PRODUCTION: 'in-progress',
  SHIPPING: 'in-progress',
  COMPLETED: 'good',
  CANCELLED: 'bad',
};

export const KEY_ACTION: Record<string, string> = {
  ORDER_CREATED: 'ADMIN.ACTION.ORDER_CREATED',
  ORDER_STATUS_CHANGED: 'ADMIN.ACTION.ORDER_STATUS_CHANGED',
  CONFIG_UPDATED: 'ADMIN.ACTION.CONFIG_UPDATED',
  PAYMENT_RECEIVED: 'ADMIN.ACTION.PAYMENT_RECEIVED',
};

export const KEY_ACTION_OTHER = 'ADMIN.ACTION.OTHER';

export const KEY_RESULT_RECONCILE: Record<string, string> = {
  MATCHED: 'ADMIN.RECONCILE.MATCHED',
  NO_REFERENCE: 'ADMIN.RECONCILE.NO_REFERENCE',
  UNDERPAID: 'ADMIN.RECONCILE.UNDERPAID',
  ALREADY_PROCESSED: 'ADMIN.RECONCILE.ALREADY_PROCESSED',
};
