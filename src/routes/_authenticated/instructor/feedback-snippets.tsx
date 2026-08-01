import { createFileRoute } from '@tanstack/react-router';
import { FeedbackSnippetsPage } from '@/components/instructor/feedback-snippets/FeedbackSnippetsPage';
import { requireRole } from '@/server/auth';

export const Route = createFileRoute('/_authenticated/instructor/feedback-snippets')({
  beforeLoad: async () => {
    await requireRole(['instructor']);
  },
  component: FeedbackSnippetsPage,
});
