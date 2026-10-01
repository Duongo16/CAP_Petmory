import { MemoryTopic } from '../core/models/api.model';

/**
 * The wording and colour of each kind of moment.
 *
 * Every key is written out in full so it stays searchable; keys are never
 * built by joining strings onto a variable.
 */
const TOPIC_KEY: Record<MemoryTopic, string> = {
  FIRST_DAY: 'MEMORY.TOPIC.FIRST_DAY',
  BIRTHDAY: 'MEMORY.TOPIC.BIRTHDAY',
  OUTING: 'MEMORY.TOPIC.OUTING',
  FUNNY: 'MEMORY.TOPIC.FUNNY',
  LEARNING: 'MEMORY.TOPIC.LEARNING',
  EVERYDAY: 'MEMORY.TOPIC.EVERYDAY',
};

const TOPIC_TONE: Record<MemoryTopic, string> = {
  FIRST_DAY: 'purple',
  BIRTHDAY: 'amber',
  OUTING: 'green',
  FUNNY: 'amber',
  LEARNING: 'purple',
  EVERYDAY: 'plain',
};

/** The order the filter chips appear in, matching the design. */
export const TOPIC_ORDER: MemoryTopic[] = [
  'FIRST_DAY',
  'BIRTHDAY',
  'OUTING',
  'FUNNY',
  'LEARNING',
  'EVERYDAY',
];

export function topicKey(topic: MemoryTopic): string {
  return TOPIC_KEY[topic] ?? TOPIC_KEY.EVERYDAY;
}

export function topicTone(topic: MemoryTopic): string {
  return TOPIC_TONE[topic] ?? TOPIC_TONE.EVERYDAY;
}
