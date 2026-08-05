import fs from 'node:fs';
import path from 'node:path';

const userFacingTargets = [
  'src/routes/_authenticated/admin/users/index.tsx',
  'src/routes/_authenticated/instructor/interventions/index.tsx',
  'src/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId.tsx',
  'src/components/admin/templates/CreateTemplateDialog.tsx',
  'src/components/admin/templates/RubricCriteriaEditor.tsx',
  'src/components/admin/templates/TemplateDetailPage.tsx',
  'src/components/consultations/ConsultationForm.tsx',
  'src/components/consultations/VerificationDialog.tsx',
  'src/components/discussions/discussion-panel.tsx',
  'src/components/gradebook/GradeReleaseControls.tsx',
  'src/components/instructor/assignments/AssignmentWizard.tsx',
  'src/components/instructor/assignments/StudentPicker.tsx',
  'src/components/instructor/assignments/TemplatePicker.tsx',
  'src/components/instructor/feedback-snippets/FeedbackSnippetsPage.tsx',
  'src/components/reviews/DeadlineManager.tsx',
  'src/components/reviews/FeedbackSnippetPicker.tsx',
  'src/components/student/RevisionActionPlan.tsx',
];

describe('user-facing error message contract', () => {
  it('does not propagate structured server error messages into UI code', () => {
    for (const relativePath of userFacingTargets) {
      const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

      expect(source, relativePath).not.toMatch(/(?:\w+\.)?error\.message/);
    }
  });
});
