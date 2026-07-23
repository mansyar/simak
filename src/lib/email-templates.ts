import { escapeHtml } from './email';
import type { Locales } from '../i18n/types';
import { getEnv } from '../config/env';

// --- Locale normalization -------------------------------------------------

function normalizeLocale(locale: Locales | null | undefined): Locales {
  return locale === 'id' ? 'id' : 'en';
}

// --- Shared HTML fragments ------------------------------------------------

const HEADER_HTML = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr><td style="padding: 40px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
        <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">SIMAK</h1>
        <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0;">Sistem Informasi dan Manajemen Akademik</p>
      </td></tr>`;

const FOOTER_HTML = `      <tr><td style="padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2026 SIMAK. All rights reserved.</p>
      </td></tr>
    </table>
  </body>
</html>`;

export function buildEmailHeader(_locale: Locales): string {
  return HEADER_HTML;
}

export function buildEmailFooter(_locale: Locales): string {
  return FOOTER_HTML;
}

function detailRow(label: string, value: string): string {
  return `<tr><td style="padding: 8px 16px; background-color: #f3f4f6; font-size: 14px; font-weight: 600; color: #374151;">${label}</td><td style="padding: 8px 16px; font-size: 14px; color: #374151;">${value}</td></tr>`;
}

function detailTable(rows: string): string {
  return `<table cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px; border-collapse: collapse;">${rows}</table>`;
}

function deepLinkButton(url: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin: 0 auto 32px;"><tr><td style="background-color: #2563eb; border-radius: 6px; padding: 12px 24px;"><a href="${url}" style="color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block;">${label}</a></td></tr></table>`;
}

function fallbackLink(url: string, text: string): string {
  return `<p style="font-size: 14px; color: #9ca3af; margin: 0;">${text}<br/><a href="${url}" style="color: #2563eb; word-break: break-all;">${url}</a></p>`;
}

function wrapBody(inner: string): string {
  return `<tr><td style="padding: 32px;">${inner}</td></tr>`;
}

function buildEmail(locale: Locales, bodyInner: string): string {
  return buildEmailHeader(locale) + wrapBody(bodyInner) + buildEmailFooter(locale);
}

// --- Localized strings ----------------------------------------------------

type EmailStrings = {
  viewInSimak: string;
  fallback: string;
  labels: {
    student: string;
    assignment: string;
    checkpoint: string;
    reviewer: string;
    instructor: string;
    result: string;
    revisionDeadline: string;
    rejectionReason: string;
    extensionDays: string;
    newDeadline: string;
    category: string;
    durationRequested: string;
  };
  results: { pass: string; revise: string };
  submissionReceived: string;
  reviewCompleted: string;
  revisionRequested: string;
  consultationVerified: string;
  consultationRejected: string;
  extensionApproved: string;
  extensionRejected: string;
  extensionRequested: string;
};

const STRINGS: Record<Locales, EmailStrings> = {
  en: {
    viewInSimak: 'View in SIMAK',
    fallback: "If the button doesn't work, copy and paste this link:",
    labels: {
      student: 'Student',
      assignment: 'Assignment',
      checkpoint: 'Checkpoint',
      reviewer: 'Reviewer',
      instructor: 'Instructor',
      result: 'Result',
      revisionDeadline: 'Revision Deadline',
      rejectionReason: 'Rejection Reason',
      extensionDays: 'Extension Days',
      newDeadline: 'New Deadline',
      category: 'Category',
      durationRequested: 'Duration Requested (days)',
    },
    results: { pass: 'Pass', revise: 'Revise' },
    submissionReceived: 'A student has submitted a checkpoint for review.',
    reviewCompleted: 'Your checkpoint review has been completed. You passed!',
    revisionRequested: 'Your checkpoint needs revision. Please review the feedback and resubmit.',
    consultationVerified: 'Your consultation has been verified.',
    consultationRejected: 'Your consultation has been rejected.',
    extensionApproved: 'Your extension request has been approved.',
    extensionRejected: 'Your extension request has been rejected.',
    extensionRequested: 'A student has requested an extension.',
  },
  id: {
    viewInSimak: 'Lihat di SIMAK',
    fallback: 'Jika tombol tidak berfungsi, salin dan tempel tautan ini:',
    labels: {
      student: 'Mahasiswa',
      assignment: 'Tugas',
      checkpoint: 'Checkpoint',
      reviewer: 'Pemberi Tinjauan',
      instructor: 'Dosen',
      result: 'Hasil',
      revisionDeadline: 'Batas Waktu Revisi',
      rejectionReason: 'Alasan Penolakan',
      extensionDays: 'Hari Perpanjangan',
      newDeadline: 'Batas Waktu Baru',
      category: 'Kategori',
      durationRequested: 'Durasi yang Diminta (hari)',
    },
    results: { pass: 'Lulus', revise: 'Revisi' },
    submissionReceived: 'Seorang mahasiswa telah mengirimkan checkpoint untuk ditinjau.',
    reviewCompleted: 'Tinjauan checkpoint Anda telah selesai. Anda lulus!',
    revisionRequested:
      'Checkpoint Anda perlu direvisi. Silakan tinjau umpan balik dan kirim ulang.',
    consultationVerified: 'Konsultasi Anda telah diverifikasi.',
    consultationRejected: 'Konsultasi Anda telah ditolak.',
    extensionApproved: 'Permintaan perpanjangan Anda telah disetujui.',
    extensionRejected: 'Permohonan perpanjangan Anda telah ditolak.',
    extensionRequested: 'Seorang mahasiswa telah meminta perpanjangan.',
  },
};

// --- Template builders ----------------------------------------------------

export function buildSubmissionReceivedHtml(params: {
  studentName: string;
  assignmentName: string;
  checkpointName: string;
  submissionId: number;
  locale?: Locales | null;
}): string {
  const locale = normalizeLocale(params.locale);
  const s = STRINGS[locale];
  const url = `${getEnv().BETTER_AUTH_URL}/instructor/reviews/${params.submissionId}`;
  const body =
    `<p style="font-size: 16px; color: #374151; margin: 0 0 16px;">${s.submissionReceived}</p>` +
    detailTable(
      detailRow(s.labels.student, escapeHtml(params.studentName)) +
        detailRow(s.labels.assignment, escapeHtml(params.assignmentName)) +
        detailRow(s.labels.checkpoint, escapeHtml(params.checkpointName)),
    ) +
    deepLinkButton(url, s.viewInSimak) +
    fallbackLink(url, s.fallback);
  return buildEmail(locale, body);
}

export function buildReviewCompletedHtml(params: {
  reviewerName: string;
  assignmentName: string;
  checkpointName: string;
  assignmentId: number;
  locale?: Locales | null;
}): string {
  const locale = normalizeLocale(params.locale);
  const s = STRINGS[locale];
  const url = `${getEnv().BETTER_AUTH_URL}/student/assignments/${params.assignmentId}`;
  const body =
    `<p style="font-size: 16px; color: #374151; margin: 0 0 16px;">${s.reviewCompleted}</p>` +
    detailTable(
      detailRow(s.labels.reviewer, escapeHtml(params.reviewerName)) +
        detailRow(s.labels.assignment, escapeHtml(params.assignmentName)) +
        detailRow(s.labels.checkpoint, escapeHtml(params.checkpointName)) +
        detailRow(s.labels.result, s.results.pass),
    ) +
    deepLinkButton(url, s.viewInSimak) +
    fallbackLink(url, s.fallback);
  return buildEmail(locale, body);
}

export function buildRevisionRequestedHtml(params: {
  reviewerName: string;
  assignmentName: string;
  checkpointName: string;
  assignmentId: number;
  revisionDeadline: string;
  locale?: Locales | null;
}): string {
  const locale = normalizeLocale(params.locale);
  const s = STRINGS[locale];
  const url = `${getEnv().BETTER_AUTH_URL}/student/assignments/${params.assignmentId}`;
  const body =
    `<p style="font-size: 16px; color: #374151; margin: 0 0 16px;">${s.revisionRequested}</p>` +
    detailTable(
      detailRow(s.labels.reviewer, escapeHtml(params.reviewerName)) +
        detailRow(s.labels.assignment, escapeHtml(params.assignmentName)) +
        detailRow(s.labels.checkpoint, escapeHtml(params.checkpointName)) +
        detailRow(s.labels.result, s.results.revise) +
        detailRow(s.labels.revisionDeadline, escapeHtml(params.revisionDeadline)),
    ) +
    deepLinkButton(url, s.viewInSimak) +
    fallbackLink(url, s.fallback);
  return buildEmail(locale, body);
}

export function buildConsultationVerifiedHtml(params: {
  instructorName: string;
  checkpointName: string;
  assignmentId: number;
  locale?: Locales | null;
}): string {
  const locale = normalizeLocale(params.locale);
  const s = STRINGS[locale];
  const url = `${getEnv().BETTER_AUTH_URL}/student/assignments/${params.assignmentId}`;
  const body =
    `<p style="font-size: 16px; color: #374151; margin: 0 0 16px;">${s.consultationVerified}</p>` +
    detailTable(
      detailRow(s.labels.instructor, escapeHtml(params.instructorName)) +
        detailRow(s.labels.checkpoint, escapeHtml(params.checkpointName)),
    ) +
    deepLinkButton(url, s.viewInSimak) +
    fallbackLink(url, s.fallback);
  return buildEmail(locale, body);
}

export function buildConsultationRejectedHtml(params: {
  instructorName: string;
  checkpointName: string;
  assignmentId: number;
  rejectionReason: string;
  locale?: Locales | null;
}): string {
  const locale = normalizeLocale(params.locale);
  const s = STRINGS[locale];
  const url = `${getEnv().BETTER_AUTH_URL}/student/assignments/${params.assignmentId}`;
  const body =
    `<p style="font-size: 16px; color: #374151; margin: 0 0 16px;">${s.consultationRejected}</p>` +
    detailTable(
      detailRow(s.labels.instructor, escapeHtml(params.instructorName)) +
        detailRow(s.labels.checkpoint, escapeHtml(params.checkpointName)) +
        detailRow(s.labels.rejectionReason, escapeHtml(params.rejectionReason)),
    ) +
    deepLinkButton(url, s.viewInSimak) +
    fallbackLink(url, s.fallback);
  return buildEmail(locale, body);
}

export function buildExtensionApprovedHtml(params: {
  instructorName: string;
  assignmentName: string;
  assignmentId: number;
  extensionDays: number;
  newDeadline: string;
  locale?: Locales | null;
}): string {
  const locale = normalizeLocale(params.locale);
  const s = STRINGS[locale];
  const url = `${getEnv().BETTER_AUTH_URL}/student/assignments/${params.assignmentId}`;
  const deadlineRow = params.newDeadline
    ? detailRow(s.labels.newDeadline, escapeHtml(params.newDeadline))
    : '';
  const body =
    `<p style="font-size: 16px; color: #374151; margin: 0 0 16px;">${s.extensionApproved}</p>` +
    detailTable(
      detailRow(s.labels.instructor, escapeHtml(params.instructorName)) +
        detailRow(s.labels.assignment, escapeHtml(params.assignmentName)) +
        detailRow(s.labels.extensionDays, String(params.extensionDays)) +
        deadlineRow,
    ) +
    deepLinkButton(url, s.viewInSimak) +
    fallbackLink(url, s.fallback);
  return buildEmail(locale, body);
}

export function buildExtensionRejectedHtml(params: {
  instructorName: string;
  assignmentName: string;
  assignmentId: number;
  rejectionReason: string;
  locale?: Locales | null;
}): string {
  const locale = normalizeLocale(params.locale);
  const s = STRINGS[locale];
  const url = `${getEnv().BETTER_AUTH_URL}/student/assignments/${params.assignmentId}`;
  const body =
    `<p style="font-size: 16px; color: #374151; margin: 0 0 16px;">${s.extensionRejected}</p>` +
    detailTable(
      detailRow(s.labels.instructor, escapeHtml(params.instructorName)) +
        detailRow(s.labels.assignment, escapeHtml(params.assignmentName)) +
        detailRow(s.labels.rejectionReason, escapeHtml(params.rejectionReason)),
    ) +
    deepLinkButton(url, s.viewInSimak) +
    fallbackLink(url, s.fallback);
  return buildEmail(locale, body);
}

export function buildExtensionRequestedHtml(params: {
  studentName: string;
  assignmentName: string;
  assignmentId: number;
  category: string;
  durationRequested: number;
  locale?: Locales | null;
}): string {
  const locale = normalizeLocale(params.locale);
  const s = STRINGS[locale];
  const url = `${getEnv().BETTER_AUTH_URL}/instructor/assignments/${params.assignmentId}`;
  const body =
    `<p style="font-size: 16px; color: #374151; margin: 0 0 16px;">${s.extensionRequested}</p>` +
    detailTable(
      detailRow(s.labels.student, escapeHtml(params.studentName)) +
        detailRow(s.labels.assignment, escapeHtml(params.assignmentName)) +
        detailRow(s.labels.category, escapeHtml(params.category)) +
        detailRow(s.labels.durationRequested, String(params.durationRequested)),
    ) +
    deepLinkButton(url, s.viewInSimak) +
    fallbackLink(url, s.fallback);
  return buildEmail(locale, body);
}
