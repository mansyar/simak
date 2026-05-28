import { Sun, Moon } from 'lucide-react';
import { useI18n } from '../../routes/__root';

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: 'light' | 'dark';
  onToggle: () => void;
}) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center justify-center rounded-md p-2 min-h-11 min-w-11 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label={theme === 'light' ? t('theme.dark') : t('theme.light')}
    >
      {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
