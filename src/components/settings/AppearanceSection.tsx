import { Sun, Moon, Paintbrush } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/routes/__root';
import { useTheme } from '@/hooks/use-theme';

export function AppearanceSection() {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paintbrush className="h-5 w-5" />
          {t('settings.appearance.title')}
        </CardTitle>
        <CardDescription>{t('settings.appearance.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Language */}
        <div className="space-y-2">
          <Label>{t('settings.appearance.languageLabel')}</Label>
          <div className="inline-flex items-center gap-1 rounded-md border border-border p-1">
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`rounded px-2 py-1 min-h-11 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                locale === 'en'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLocale('id')}
              className={`rounded px-2 py-1 min-h-11 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                locale === 'id'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              ID
            </button>
          </div>
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <Label>{t('settings.appearance.themeLabel')}</Label>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center justify-center rounded-md p-2 min-h-11 min-w-11 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('theme.toggle')}
          >
            {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
