import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useI18n } from '@/routes/__root';
import { cn } from '@/lib/utils';

interface KeyboardCheatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isReviewPage: boolean;
}

export function KeyboardCheatSheet({ isOpen, onClose, isReviewPage }: KeyboardCheatSheetProps) {
  const { t } = useI18n();

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger
        render={<button className="sr-only" aria-label={t('shortcuts.cheatSheet.title')} />}
      />
      <PopoverContent>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('shortcuts.cheatSheet.title')}</p>
          <div data-shortcut="R" className="flex items-center justify-between gap-4">
            <kbd className="rounded border px-1.5 py-0.5 text-xs">R</kbd>
            <span className="text-sm">{t('shortcuts.cheatSheet.refresh')}</span>
          </div>
          <div data-shortcut="?" className="flex items-center justify-between gap-4">
            <kbd className="rounded border px-1.5 py-0.5 text-xs">?</kbd>
            <span className="text-sm">{t('shortcuts.cheatSheet.help')}</span>
          </div>
          <div
            data-shortcut="J"
            className={cn('flex items-center justify-between gap-4', !isReviewPage && 'opacity-50')}
          >
            <kbd className="rounded border px-1.5 py-0.5 text-xs">J</kbd>
            <span className="text-sm">{t('shortcuts.cheatSheet.nextReview')}</span>
          </div>
          <div
            data-shortcut="K"
            className={cn('flex items-center justify-between gap-4', !isReviewPage && 'opacity-50')}
          >
            <kbd className="rounded border px-1.5 py-0.5 text-xs">K</kbd>
            <span className="text-sm">{t('shortcuts.cheatSheet.prevReview')}</span>
          </div>
          {!isReviewPage && (
            <p className="text-xs text-muted-foreground">
              {t('shortcuts.cheatSheet.notOnReviewPage')}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
