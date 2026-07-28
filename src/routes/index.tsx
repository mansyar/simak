import { createFileRoute, Link } from '@tanstack/react-router';

import { useI18n } from './__root';
import { Layers, MessageSquare, Users, Clock, Globe, Shield } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const features = [
  { key: 'sequentialCheckpoints', Icon: Layers },
  { key: 'structuredFeedback', Icon: MessageSquare },
  { key: 'consultationTracking', Icon: Users },
  { key: 'deadlineManagement', Icon: Clock },
  { key: 'bilingualSupport', Icon: Globe },
  { key: 'roleBasedAccess', Icon: Shield },
] as const;

const steps = ['step1', 'step2', 'step3'] as const;

export function HomePage() {
  const { t } = useI18n();

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen flex-col">
      {/* Hero */}
      <section
        id="hero"
        className="relative flex flex-col items-center justify-center px-6 py-24 text-center"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#6B5CE7]/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#34D399]/10 blur-3xl" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {t('landing.hero.headline')}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            {t('landing.hero.subheadline')}
          </p>
          <div className="mt-8">
            <Link
              to="/auth/login"
              className="inline-flex h-12 items-center rounded-lg bg-[#6B5CE7] px-8 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#5a4bd6]"
            >
              {t('landing.hero.cta')}
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/50 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground">{t('landing.features.title')}</h2>
            <p className="mt-3 text-muted-foreground">{t('landing.features.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ key, Icon }) => (
              <div
                key={key}
                className="rounded-xl border bg-background p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#6B5CE7]/10">
                  <Icon className="h-5 w-5 text-[#6B5CE7]" />
                </div>
                <h3 className="font-semibold text-foreground">
                  {t(`landing.features.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`landing.features.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground">{t('landing.howItWorks.title')}</h2>
            <p className="mt-3 text-muted-foreground">{t('landing.howItWorks.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#34D399] text-lg font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {t(`landing.howItWorks.${step}.title`)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`landing.howItWorks.${step}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div>
            <p className="text-lg font-bold text-foreground">{t('app.name')}</p>
            <p className="text-sm text-muted-foreground">{t('landing.footer.description')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('landing.footer.copyright', { year: String(new Date().getFullYear()) })}
            </p>
          </div>
          <nav className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/auth/login" className="hover:text-foreground">
              {t('landing.footer.links.login')}
            </Link>
            <a href="#how-it-works" className="hover:text-foreground">
              {t('landing.footer.links.about')}
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
