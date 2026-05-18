export function LanguageSwitcher({
  currentLocale,
  onSwitch,
}: {
  currentLocale: 'en' | 'id'
  onSwitch: (locale: 'en' | 'id') => void
}) {
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
        aria-label="Switch to English"
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
        aria-label="Ganti ke Bahasa Indonesia"
      >
        ID
      </button>
    </div>
  )
}
