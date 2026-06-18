/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock useI18n hook
const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'landing.hero.headline': 'Manage Academic Assignments with Confidence',
    'landing.hero.subheadline':
      'SIMAK helps students and instructors track progress, manage checkpoints, and ensure timely submissions through a structured workflow.',
    'landing.hero.cta': 'Get Started',
    'landing.features.title': 'Everything You Need',
    'landing.features.subtitle':
      'A complete platform for managing academic assignments from start to finish.',
    'landing.features.sequentialCheckpoints.title': 'Sequential Checkpoints',
    'landing.features.sequentialCheckpoints.description':
      'Structured milestones that guide students through each phase of their academic work.',
    'landing.features.structuredFeedback.title': 'Structured Feedback',
    'landing.features.structuredFeedback.description':
      'Instructors provide actionable feedback with pass or revise decisions at every checkpoint.',
    'landing.features.consultationTracking.title': 'Consultation Tracking',
    'landing.features.consultationTracking.description':
      'Log and verify consultation sessions to ensure students receive proper guidance.',
    'landing.features.deadlineManagement.title': 'Deadline Management',
    'landing.features.deadlineManagement.description':
      'Clear deadlines with extension requests and escalation alerts keep everyone on track.',
    'landing.features.bilingualSupport.title': 'Bilingual Support',
    'landing.features.bilingualSupport.description':
      'Full support for English and Bahasa Indonesia for inclusive academic environments.',
    'landing.features.roleBasedAccess.title': 'Role-Based Access',
    'landing.features.roleBasedAccess.description':
      'Tailored experiences for students, instructors, and administrators with proper permissions.',
    'landing.howItWorks.title': 'How It Works',
    'landing.howItWorks.subtitle': 'Three simple steps to get started.',
    'landing.howItWorks.step1.title': 'Create',
    'landing.howItWorks.step1.description':
      'Instructors set up templates with checkpoints and assign them to students.',
    'landing.howItWorks.step2.title': 'Submit',
    'landing.howItWorks.step2.description':
      'Students upload their work at each checkpoint and track their progress.',
    'landing.howItWorks.step3.title': 'Review',
    'landing.howItWorks.step3.description':
      'Instructors review submissions and provide feedback to guide students forward.',
    'landing.footer.description': 'Academic Information & Management System',
    'landing.footer.links.assignments': 'Assignments',
    'landing.footer.links.consultations': 'Consultations',
    'landing.footer.links.settings': 'Settings',
  };
  return translations[key] || key;
};

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: mockT, locale: 'en' }),
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
    }: {
      children: React.ReactNode;
      to?: string;
      className?: string;
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  };
});

// Import after mocking
import { HomePage } from '@/routes/index';

describe('Landing Page', () => {
  describe('Hero section', () => {
    it('renders headline', () => {
      render(<HomePage />);
      expect(screen.getByText('Manage Academic Assignments with Confidence')).toBeDefined();
    });

    it('renders subheadline', () => {
      render(<HomePage />);
      expect(
        screen.getByText(
          'SIMAK helps students and instructors track progress, manage checkpoints, and ensure timely submissions through a structured workflow.',
        ),
      ).toBeDefined();
    });

    it('renders CTA button linking to /auth/login', () => {
      render(<HomePage />);
      const ctaLink = screen.getByText('Get Started').closest('a');
      expect(ctaLink).toBeDefined();
      expect(ctaLink?.getAttribute('href')).toBe('/auth/login');
    });
  });

  describe('Features section', () => {
    it('renders features title', () => {
      render(<HomePage />);
      expect(screen.getByText('Everything You Need')).toBeDefined();
    });

    it('renders features subtitle', () => {
      render(<HomePage />);
      expect(
        screen.getByText(
          'A complete platform for managing academic assignments from start to finish.',
        ),
      ).toBeDefined();
    });

    it('renders all 6 feature cards', () => {
      render(<HomePage />);
      expect(screen.getByText('Sequential Checkpoints')).toBeDefined();
      expect(screen.getByText('Structured Feedback')).toBeDefined();
      expect(screen.getByText('Consultation Tracking')).toBeDefined();
      expect(screen.getByText('Deadline Management')).toBeDefined();
      expect(screen.getByText('Bilingual Support')).toBeDefined();
      expect(screen.getByText('Role-Based Access')).toBeDefined();
    });
  });

  describe('How It Works section', () => {
    it('renders how it works title', () => {
      render(<HomePage />);
      expect(screen.getByText('How It Works')).toBeDefined();
    });

    it('renders how it works subtitle', () => {
      render(<HomePage />);
      expect(screen.getByText('Three simple steps to get started.')).toBeDefined();
    });

    it('renders all 3 steps', () => {
      render(<HomePage />);
      expect(screen.getByText('Create')).toBeDefined();
      expect(screen.getByText('Submit')).toBeDefined();
      expect(screen.getByText('Review')).toBeDefined();
    });

    it('renders step descriptions', () => {
      render(<HomePage />);
      expect(
        screen.getByText(
          'Instructors set up templates with checkpoints and assign them to students.',
        ),
      ).toBeDefined();
      expect(
        screen.getByText('Students upload their work at each checkpoint and track their progress.'),
      ).toBeDefined();
      expect(
        screen.getByText(
          'Instructors review submissions and provide feedback to guide students forward.',
        ),
      ).toBeDefined();
    });
  });

  describe('Footer', () => {
    it('renders app name', () => {
      render(<HomePage />);
      expect(screen.getByText('SIMAK')).toBeDefined();
    });

    it('renders footer description', () => {
      render(<HomePage />);
      expect(screen.getByText('Academic Information & Management System')).toBeDefined();
    });

    it('renders footer links', () => {
      render(<HomePage />);
      expect(screen.getByText('Assignments')).toBeDefined();
      expect(screen.getByText('Consultations')).toBeDefined();
      expect(screen.getByText('Settings')).toBeDefined();
    });
  });
});
