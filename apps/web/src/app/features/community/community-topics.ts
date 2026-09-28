import { PostTopic } from '../../core/models/community.model';

/**
 * Translation key lookup for post topics. Every key is declared explicitly so
 * it can be found in the source. Keys are never built by joining strings.
 */
const KEY_TOPIC: Record<PostTopic, string> = {
  MOMENT: 'COMMUNITY.TOPIC.MOMENT',
  MEMORIAL: 'COMMUNITY.TOPIC.MEMORIAL',
  EXPERIENCE: 'COMMUNITY.TOPIC.EXPERIENCE',
  PRODUCT: 'COMMUNITY.TOPIC.PRODUCT',
  TRADE: 'COMMUNITY.TOPIC.TRADE',
  OTHER: 'COMMUNITY.TOPIC.OTHER',
};

/** The opening line each topic offers in the composer, declared the same way. */
const KEY_TEMPLATE: Record<PostTopic, string> = {
  MOMENT: 'COMMUNITY.TEMPLATE.MOMENT',
  MEMORIAL: 'COMMUNITY.TEMPLATE.MEMORIAL',
  EXPERIENCE: 'COMMUNITY.TEMPLATE.EXPERIENCE',
  PRODUCT: 'COMMUNITY.TEMPLATE.PRODUCT',
  TRADE: 'COMMUNITY.TEMPLATE.TRADE',
  OTHER: 'COMMUNITY.TEMPLATE.OTHER',
};

/** The colour group each topic is drawn in, so no colour sits in a template. */
const TONE_TOPIC: Record<PostTopic, string> = {
  MOMENT: 'accent',
  MEMORIAL: 'memorial',
  EXPERIENCE: 'success',
  PRODUCT: 'info',
  TRADE: 'accent',
  OTHER: 'muted',
};

/** Display order of the topic chips above the feed. */
export const TOPIC_ORDER: PostTopic[] = [
  'MOMENT',
  'MEMORIAL',
  'EXPERIENCE',
  'PRODUCT',
  'TRADE',
  'OTHER',
];

export function topicKey(topic: PostTopic): string {
  return KEY_TOPIC[topic] ?? 'COMMUNITY.TOPIC.OTHER';
}

export function templateKey(topic: PostTopic): string {
  return KEY_TEMPLATE[topic] ?? 'COMMUNITY.TEMPLATE.OTHER';
}

export function topicTone(topic: PostTopic): string {
  return TONE_TOPIC[topic] ?? 'muted';
}
