import { useI18n } from '../../routes/__root';

export function LanguageSwitcher({
  currentLocale,
  onSwitch,
}: {
  currentLocale: 'en' | 'id';
  onSwitch: (locale: 'en' | 'id') => void;
}) {
  const { t } = useI18n();

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border p-1">
      <button
        type="button"
        onClick={() => onSwitch('en')}
        className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
          currentLocale === 'en'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
        aria-label={t('language.switchToEnglish')}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onSwitch('id')}
        className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
          currentLocale === 'id'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
        aria-label={t('language.switchToIndonesian')}
      >
        ID
      </button>
    </div>
  );
}
