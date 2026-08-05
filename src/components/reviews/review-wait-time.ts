import type { useI18n } from '../../routes/__root';

type ReviewTranslator = ReturnType<typeof useI18n>['t'];

export function formatReviewWaitTime(uploadedAt: Date, t: ReviewTranslator): string {
  const diff = Math.max(0, Date.now() - new Date(uploadedAt).getTime());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return t('instructorReviews.waitTime.daysHours', {
      days: String(days),
      hours: String(hours % 24),
    });
  }

  if (hours > 0) {
    return t('instructorReviews.waitTime.hours', { hours: String(hours) });
  }

  return t('instructorReviews.waitTime.lessThanHour');
}
