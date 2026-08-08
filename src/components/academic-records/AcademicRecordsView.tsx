import { Badge, badgeVariants } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import type {
  AcademicRecordView as AcademicRecord,
  AcademicRecordsResponse,
  AcademicRecordsResult,
} from '@/server/academic-records';
import { useI18n } from '@/routes/__root';
import type { VariantProps } from 'class-variance-authority';

type AcademicRecordsRole = 'student' | 'instructor' | 'admin';

type TermOption = {
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
  return (
    <Badge variant={statusVariants[record.status]}>
      {t(`academicRecords.status.${record.status}` as never)}
    </Badge>
  );
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

function RecordCard({ record, showMetadata }: { record: AcademicRecord; showMetadata: boolean }) {
  const { t } = useI18n();
  const isComplete = record.status === 'complete';
  return (
    <article className="rounded-lg border bg-card p-4 shadow-xs transition-colors hover:bg-muted/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold tracking-wide text-primary">
            {record.courseCode}
          </p>
          <h3 className="font-medium text-foreground">{record.courseName}</h3>
          <p className="text-sm text-muted-foreground">
            {record.termName} · {t('academicRecords.section')} {record.sectionCode}
          </p>
        </div>
        <StatusBadge record={record} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
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
      <button
        type="button"
        className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('academicRecords.previous')}
      </button>
      <span className="text-sm text-muted-foreground">
        {page} / {pageCount}
      </span>
      <button
        type="button"
        className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        {t('academicRecords.next')}
      </button>
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
}: AcademicRecordsViewProps) {
  const { t } = useI18n();
  const subtitle =
    role === 'student'
      ? t('academicRecords.subtitle.student')
      : role === 'instructor'
        ? t('academicRecords.subtitle.instructor')
        : t('academicRecords.subtitle.admin');

  if (isServerError(data)) {
    return (
      <Card role="alert" className="border-destructive/40">
        <CardHeader>
          <CardTitle>{t(getErrorTranslationKey(data.error.code))}</CardTitle>
          <CardDescription>{t('academicRecords.loadError')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const showMetadata = role === 'admin';
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
        {terms.length > 0 && onTermChange && (
          <label className="grid gap-1 text-sm font-medium">
            {t('academicRecords.termFilter')}
            <select
              aria-label={t('academicRecords.termFilter')}
              className="h-10 min-w-48 rounded-md border bg-background px-3 text-sm"
              value={selectedTermId ?? ''}
              onChange={(event) =>
                onTermChange(event.target.value ? Number(event.target.value) : undefined)
              }
            >
              <option value="">{t('academicRecords.allTerms')}</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GpaSummary label={t('academicRecords.termGpa')} summary={data.termGpa} />
        <GpaSummary label={t('academicRecords.cumulativeGpa')} summary={data.cumulativeGpa} />
      </div>

      {data.records.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardHeader>
            <CardTitle>{t('academicRecords.empty')}</CardTitle>
            <CardDescription>{t('academicRecords.gpaUnavailable')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3" aria-label={t('academicRecords.recordList')}>
          {data.records.map((record) => (
            <RecordCard key={record.recordId} record={record} showMetadata={showMetadata} />
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
