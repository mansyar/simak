import { createFileRoute } from '@tanstack/react-router';
import { FeedbackSnippetsPage } from '@/components/instructor/feedback-snippets/FeedbackSnippetsPage';

export const Route = createFileRoute('/_authenticated/instructor/feedback-snippets')({
  component: FeedbackSnippetsPage,
});
