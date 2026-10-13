import { HttpErrorResponse } from '@angular/common/http';
import { ImageUnreadable } from './upload-image';

/**
 * Returns a safe, actionable message when the browser could not prepare an
 * image or the API rejected it. API messages are explicit validation messages
 * (file type/size), while unknown transport failures deliberately fall back to
 * the screen's translated error.
 */
export function avatarUploadErrorMessage(error: unknown): string | null {
  if (error instanceof ImageUnreadable) {
    return `Kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c \u1ea3nh \u201c${error.fileName}\u201d. H\u00e3y ch\u1ecdn \u1ea3nh JPG, PNG ho\u1eb7c WEBP kh\u00e1c.`;
  }

  if (error instanceof HttpErrorResponse) {
    const message = error.error && typeof error.error === 'object' ? error.error.message : null;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    if (Array.isArray(message)) {
      const detail = message
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .join(' ');
      if (detail) {
        return detail;
      }
    }
    return null;
  }

  if (error instanceof Error) {
    return 'Kh\u00f4ng th\u1ec3 x\u1eed l\u00fd \u1ea3nh \u0111\u00e3 ch\u1ecdn. H\u00e3y th\u1eed m\u1ed9t \u1ea3nh JPG, PNG ho\u1eb7c WEBP kh\u00e1c.';
  }

  return null;
}
