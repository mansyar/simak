import { jsx as _jsx } from 'react/jsx-runtime';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FileQuestion } from 'lucide-react';
import { useI18n } from '../../../routes/__root';
export function TemplateEmptyState({ onCreateNew }) {
  const { t } = useI18n();
  return _jsx(EmptyState, {
    icon: FileQuestion,
    title: t('adminTemplates.empty'),
    description: t('adminTemplates.createPrompt'),
    children: _jsx(Button, { onClick: onCreateNew, children: t('adminTemplates.newTemplate') }),
  });
}
