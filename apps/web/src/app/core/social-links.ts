/**
 * Where the contact buttons point. Kept in one place so a channel is never
 * written into a template, and so changing an address touches a single file.
 */
export interface SocialLink {
  /** Translation key for the channel name. */
  key: string;
  url: string;
  /** Short label drawn with a character, so no icon font is needed. */
  glyph: string;
  /** Colour group the stylesheet uses to tint the button. */
  tone: 'facebook' | 'tiktok' | 'zalo';
}

export const SOCIAL_LINKS: SocialLink[] = [
  { key: 'SOCIAL.FACEBOOK', url: 'https://www.facebook.com/petmory.vn', glyph: 'f', tone: 'facebook' },
  { key: 'SOCIAL.TIKTOK', url: 'https://www.tiktok.com/@petmory.vn', glyph: '♪', tone: 'tiktok' },
  { key: 'SOCIAL.ZALO', url: 'https://zalo.me/petmory', glyph: 'Z', tone: 'zalo' },
];
