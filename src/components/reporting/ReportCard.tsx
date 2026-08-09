import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useI18n } from '@/routes/__root';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MutationFeedback } from '@/components/ui/mutation-feedback';
import { ReportFilterFields } from '@/components/reporting/ReportFilterFields';
import { ReportStudentPicker } from '@/components/reporting/ReportStudentPicker';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import type { TranslationKey } from '@/i18n/index';
import {
  buildReportRequest,
  type CatalogFilterOptions,
  type SelectedReportFilters,
} from '@/lib/reporting-options';
import type {
  ReportJobState,
  ReportLocale,
  ReportType,
  ReportingRole,
} from '@/lib/reporting-policy';
import { requestReport } from '@/server/reporting';

type ReportCardProps = {
  reportType: ReportType;
  role: ReportingRole;
  options: CatalogFilterOptions;
};

const DEFAULT_FILTERS: SelectedReportFilters = {
  termId: null,
  courseId: null,
  sectionId: null,
  cohort: null,
};

const REPORT_TYPE_NAME_KEYS: Record<ReportType, TranslationKey> = {
  institutional_academic_summary: 'reports.types.institutional_academic_summary.name',
  official_transcript: 'reports.types.official_transcript.name',
  analytics_summary: 'reports.types.analytics_summary.name',
};

function reportDescriptionKey(reportType: ReportType, role: ReportingRole): TranslationKey {
  if (reportType === 'official_transcript') {
    return role === 'student'
      ? 'reports.types.official_transcript.description'
      : 'reports.types.official_transcript.descriptionAdmin';
  }
  return `reports.types.${reportType}.description`;
}

function ReportLocaleToggle({
  locale,
  onChange,
}: {
  locale: ReportLocale;
  onChange: (locale: ReportLocale) => void;
}) {
  const { t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('reports.locale.label')}
      className="inline-flex rounded-md border border-border p-1"
    >
      <button
        type="button"
        onClick={() => onChange('en')}
        aria-label={t('reports.locale.english')}
        aria-pressed={locale === 'en'}
        className={`min-h-11 rounded px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          locale === 'en'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange('id')}
        aria-label={t('reports.locale.indonesian')}
        aria-pressed={locale === 'id'}
        className={`min-h-11 rounded px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          locale === 'id'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        ID
      </button>
    </div>
  );
}

export function ReportCard({ reportType, role, options }: ReportCardProps) {
  const { t } = useI18n();
  const [filters, setFilters] = useState<SelectedReportFilters>(DEFAULT_FILTERS);
  const [locale, setLocale] = useState<ReportLocale>('en');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [jobState, setJobState] = useState<ReportJobState | null>(null);

  const requiresStudent = role !== 'student' && reportType === 'official_transcript';
  const nameKey = REPORT_TYPE_NAME_KEYS[reportType];

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await requestReport(
        buildReportRequest(reportType, role, locale, filters, studentId),
      );
      if (isServerError(result)) {
        throw new Error(t(getErrorTranslationKey(result.error.code)));
      }
      return result.job;
    },
    onSuccess: (job) => {
      setValidationError(null);
      if (job.state) setJobState(job.state);
    },
    onError: (error) => {
      setJobState(null);
      setValidationError(error instanceof Error ? error.message : t('error.internal'));
    },
  });

  const handleGenerate = () => {
    if (requiresStudent && !studentId) {
      setJobState(null);
      setValidationError(t('reports.validation.studentRequired'));
      return;
    }
    setJobState(null);
    setValidationError(null);
    generateMutation.mutate();
  };

  const isGenerating = generateMutation.isPending;

  return (
    <Card role="region" aria-label={t(nameKey)} aria-busy={isGenerating} className="shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold">{t(nameKey)}</CardTitle>
        <CardDescription>{t(reportDescriptionKey(reportType, role))}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {requiresStudent && <ReportStudentPicker value={studentId} onChange={setStudentId} />}

        <ReportFilterFields options={options} filters={filters} onChange={setFilters} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <ReportLocaleToggle locale={locale} onChange={setLocale} />
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            loading={isGenerating}
          >
            {isGenerating ? t('reports.generating') : t('reports.generate')}
          </Button>
        </div>

        {(validationError || jobState) && !isGenerating && (
          <MutationFeedback
            error={validationError ?? undefined}
            success={jobState ? t(`reports.job.${jobState}`) : undefined}
          />
        )}
      </CardContent>
    </Card>
  );
}
