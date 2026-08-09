import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { formatDate } from '@/lib/format-date';
import type {
  AcademicRecordView as AcademicRecord,
  AcademicRecordsResponse,
  AcademicRecordsResult,
} from '@/server/academic-records';
import { useI18n } from '@/routes/__root';
import type { VariantProps } from 'class-variance-authority';
import { useEffect, useRef } from 'react';

type AcademicRecordsRole = 'student' | 'instructor' | 'admin';

type TermOption = {
  id: number;
  label: string;
};

type SectionOption = {
  id: number;
  label: string;
};

type AcademicRecordsViewProps = {
  data: AcademicRecordsResult;
  role: AcademicRecordsRole;
  terms?: TermOption[];
  selectedTermId?: number;
  onTermChange?: (termId: number | undefined) => void;
  onPageChange?: (page: number) => void;
  sections?: SectionOption[];
  selectedSectionId?: number;
  onSectionChange?: (sectionId: number) => void;
  onRetry?: () => void;
};

const statusVariants: Record<
  AcademicRecord['status'],
  VariantProps<typeof badgeVariants>['variant']
> = {
  complete: 'success',
  incomplete: 'warning',
  withdrawn: 'destructive',
};

function formatNumber(value: number | null, fractionDigits = 2): string {
  return value === null ? '—' : value.toFixed(fractionDigits);
}

function StatusBadge({ record }: { record: AcademicRecord }) {
  const { t } = useI18n();
  const label = {
    complete: t('academicRecords.status.complete'),
    incomplete: t('academicRecords.status.incomplete'),
    withdrawn: t('academicRecords.status.withdrawn'),
  }[record.status];
  return <Badge variant={statusVariants[record.status]}>{label}</Badge>;
}

function GpaSummary({
  label,
  summary,
}: {
  label: string;
  summary: AcademicRecordsResponse['termGpa'];
}) {
  const { t } = useI18n();
  return (
    <Card size="sm" className="border-l-4 border-l-primary/70 bg-card/80">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          {summary ? formatNumber(summary.gpa) : t('academicRecords.gpaUnavailable')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t('academicRecords.credits')}: {summary?.totalCredits ?? 0}
        </span>
        <span>
          {t('academicRecords.qualityPoints')}: {summary?.totalQualityPoints.toFixed(2) ?? '—'}
        </span>
      </CardContent>
    </Card>
  );
}

function RecordMetadata({ record }: { record: AcademicRecord }) {
  const { t } = useI18n();
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-4">
      <div>
        <dt>{t('academicRecords.sourceAssignment')}</dt>
        <dd className="font-medium text-foreground">#{record.sourceAssignmentId}</dd>
      </div>
      <div>
        <dt>{t('academicRecords.sourceRelease')}</dt>
        <dd className="font-medium text-foreground">v{record.sourceReleaseVersion ?? '—'}</dd>
      </div>
      <div>
        <dt>{t('academicRecords.policyVersion')}</dt>
        <dd className="font-medium text-foreground">v{record.policyVersion}</dd>
      </div>
      <div>
        <dt>{t('academicRecords.recordVersion')}</dt>
        <dd className="font-medium text-foreground">v{record.recordVersion}</dd>
      </div>
    </dl>
  );
}

function RecordCard({
  record,
  showMetadata,
  showStudentIdentity,
}: {
  record: AcademicRecord;
  showMetadata: boolean;
  showStudentIdentity: boolean;
}) {
  const { locale, t } = useI18n();
  const isComplete = record.status === 'complete';
  return (
    <article className="rounded-lg border bg-card p-4 shadow-xs transition-colors hover:bg-muted/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold tracking-wide text-primary">
            {record.courseCode}
          </p>
          <h2 className="font-medium text-foreground">{record.courseName}</h2>
          <p className="text-sm text-muted-foreground">
            {record.termName} · {t('academicRecords.section')} {record.sectionCode}
          </p>
          {showStudentIdentity && (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t('academicRecords.student')}:</span>{' '}
              {record.studentName || record.studentId}
            </p>
          )}
        </div>
        <StatusBadge record={record} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div>
          <p className="text-xs text-muted-foreground">{t('academicRecords.score')}</p>
          <p className="font-medium tabular-nums">{formatNumber(record.numericScore)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('academicRecords.letterGrade')}</p>
          <p className="font-medium">{record.letterGrade ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('academicRecords.credits')}</p>
          <p className="font-medium tabular-nums">{formatNumber(record.credits)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('academicRecords.gradePoints')}</p>
          <p className="font-medium tabular-nums">{formatNumber(record.gradePoints)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('academicRecords.publishedAt')}</p>
          <p className="font-medium">
            {formatDate(record.publishedAt, locale, 'time') || t('academicRecords.notAvailable')}
          </p>
        </div>
      </div>

      {!isComplete && (
        <p className="mt-3 text-xs text-warning">{t('academicRecords.gpaExcluded')}</p>
      )}
      {showMetadata && (
        <div className="mt-4">
          <RecordMetadata record={record} />
        </div>
      )}
    </article>
  );
}

function Pagination({
  page,
  limit,
  total,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange?: (page: number) => void;
}) {
  const { t } = useI18n();
  const pageCount = Math.max(1, Math.ceil(total / limit));
  if (pageCount === 1 || !onPageChange) return null;
  return (
    <nav
      className="flex items-center justify-between gap-3"
      aria-label={t('academicRecords.pagination')}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 min-w-11"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('academicRecords.previous')}
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 min-w-11"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        {t('academicRecords.next')}
      </Button>
    </nav>
  );
}

export function AcademicRecordsView({
  data,
  role,
  terms = [],
  selectedTermId,
  onTermChange,
  onPageChange,
  sections = [],
  selectedSectionId,
  onSectionChange,
  onRetry,
}: AcademicRecordsViewProps) {
  const { t } = useI18n();
  const resultsStatusRef = useRef<HTMLParagraphElement>(null);
  const isInitialRender = useRef(true);
  const resultState = isServerError(data)
    ? `error:${data.error.code}`
    : `${selectedSectionId ?? ''}:${selectedTermId ?? ''}:${data.page}:${data.total}`;

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    resultsStatusRef.current?.focus({ preventScroll: true });
  }, [resultState]);

  const subtitle =
    role === 'student'
      ? t('academicRecords.subtitle.student')
      : role === 'instructor'
        ? t('academicRecords.subtitle.instructor')
        : t('academicRecords.subtitle.admin');

  if (isServerError(data)) {
    return (
      <ErrorState
        title={t(getErrorTranslationKey(data.error.code))}
        description={t('academicRecords.loadError')}
        retryLabel={onRetry ? t('common.retry') : undefined}
        onRetry={onRetry}
      />
    );
  }

  const showMetadata = role === 'admin';
  const showStudentIdentity = role !== 'student';
  const emptyState =
    terms.length === 0
      ? {
          title: t('academicRecords.noTerms'),
          description: t('academicRecords.noTermsDescription'),
        }
      : selectedTermId === undefined
        ? {
            title: t('academicRecords.noRecords'),
            description: t('academicRecords.noRecordsDescription'),
          }
        : {
            title: t('academicRecords.noFilterResults'),
            description: t('academicRecords.noFilterResultsDescription'),
          };

  return (
    <section className="space-y-6" aria-labelledby="academic-records-title">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            {t('academicRecords.eyebrow')}
          </p>
          <h1 id="academic-records-title" className="mt-2 text-3xl font-semibold tracking-tight">
            {t('academicRecords.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {sections.length > 0 && onSectionChange && (
            <div className="grid gap-1 text-sm font-medium">
              <span id="academic-records-section-label">{t('academicRecords.sectionFilter')}</span>
              <Select
                value={String(selectedSectionId ?? sections[0]?.id)}
                onValueChange={(value) => value && onSectionChange(Number(value))}
              >
                <SelectTrigger
                  aria-labelledby="academic-records-section-label"
                  aria-label={t('academicRecords.sectionFilter')}
                  className="min-h-11 min-w-52 focus-visible:ring-2"
                >
                  {sections.find((section) => section.id === selectedSectionId)?.label ??
                    sections[0]?.label}
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={String(section.id)}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {terms.length > 0 && onTermChange && (
            <div className="grid gap-1 text-sm font-medium">
              <span id="academic-records-term-label">{t('academicRecords.termFilter')}</span>
              <Select
                value={selectedTermId === undefined ? 'all' : String(selectedTermId)}
                onValueChange={(value) =>
                  onTermChange(value === 'all' || !value ? undefined : Number(value))
                }
              >
                <SelectTrigger
                  aria-labelledby="academic-records-term-label"
                  aria-label={t('academicRecords.termFilter')}
                  className="min-h-11 min-w-48 focus-visible:ring-2"
                >
                  {selectedTermId === undefined
                    ? t('academicRecords.allTerms')
                    : terms.find((term) => term.id === selectedTermId)?.label}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('academicRecords.allTerms')}</SelectItem>
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={String(term.id)}>
                      {term.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <p
        ref={resultsStatusRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        tabIndex={-1}
        className="sr-only"
      >
        {t('academicRecords.resultsUpdated', {
          count: String(data.total),
          page: String(data.page),
        })}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <GpaSummary label={t('academicRecords.termGpa')} summary={data.termGpa} />
        <GpaSummary label={t('academicRecords.cumulativeGpa')} summary={data.cumulativeGpa} />
      </div>

      {data.records.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle>{emptyState.title}</CardTitle>
            <CardDescription>{emptyState.description}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3" aria-label={t('academicRecords.recordList')}>
          {data.records.map((record) => (
            <RecordCard
              key={record.recordId}
              record={record}
              showMetadata={showMetadata}
              showStudentIdentity={showStudentIdentity}
            />
          ))}
        </div>
      )}

      <Pagination
        page={data.page}
        limit={data.limit}
        total={data.total}
        onPageChange={onPageChange}
      />
    </section>
  );
}
