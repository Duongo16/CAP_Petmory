import { KnowledgeTopic } from '../../core/services/assistant-knowledge.service';

/** Chu de cua kho tri thuc kem key ban dich, viet ra tung key de tim duoc. */
export const TOPIC_KEYS: { topic: KnowledgeTopic; key: string }[] = [
  { topic: 'PRODUCT', key: 'KNOWLEDGE.TOPIC.PRODUCT' },
  { topic: 'SIZE', key: 'KNOWLEDGE.TOPIC.SIZE' },
  { topic: 'LEAD_TIME', key: 'KNOWLEDGE.TOPIC.LEAD_TIME' },
  { topic: 'ORDER', key: 'KNOWLEDGE.TOPIC.ORDER' },
  { topic: 'PAYMENT', key: 'KNOWLEDGE.TOPIC.PAYMENT' },
  { topic: 'SHIPPING', key: 'KNOWLEDGE.TOPIC.SHIPPING' },
  { topic: 'POLICY', key: 'KNOWLEDGE.TOPIC.POLICY' },
  { topic: 'OTHER', key: 'KNOWLEDGE.TOPIC.OTHER' },
];

export const TOPIC_KEY: Record<KnowledgeTopic, string> = Object.fromEntries(
  TOPIC_KEYS.map((one) => [one.topic, one.key]),
) as Record<KnowledgeTopic, string>;
