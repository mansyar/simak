import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { KeyboardCheatSheet } from '@/components/keyboard-cheat-sheet';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('KeyboardCheatSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display all 4 shortcuts with labels when open', () => {
    render(<KeyboardCheatSheet isOpen={true} onClose={vi.fn()} isReviewPage={true} />);

    expect(screen.getByText('shortcuts.cheatSheet.refresh')).toBeInTheDocument();
    expect(screen.getByText('shortcuts.cheatSheet.help')).toBeInTheDocument();
    expect(screen.getByText('shortcuts.cheatSheet.nextReview')).toBeInTheDocument();
    expect(screen.getByText('shortcuts.cheatSheet.prevReview')).toBeInTheDocument();
  });

  it('should grey out J/K entries when isReviewPage is false', () => {
    render(<KeyboardCheatSheet isOpen={true} onClose={vi.fn()} isReviewPage={false} />);

    const jRow = document.querySelector('[data-shortcut="J"]');
    const kRow = document.querySelector('[data-shortcut="K"]');

    expect(jRow).toHaveClass('opacity-50');
    expect(kRow).toHaveClass('opacity-50');

    expect(screen.getByText('shortcuts.cheatSheet.notOnReviewPage')).toBeInTheDocument();
  });

  it('should always enable R and ? regardless of isReviewPage', () => {
    render(<KeyboardCheatSheet isOpen={true} onClose={vi.fn()} isReviewPage={false} />);

    const rRow = document.querySelector('[data-shortcut="R"]');
    const questionRow = document.querySelector('[data-shortcut="?"]');

    expect(rRow).not.toHaveClass('opacity-50');
    expect(questionRow).not.toHaveClass('opacity-50');
  });

  it('should not show notOnReviewPage message when isReviewPage is true', () => {
    render(<KeyboardCheatSheet isOpen={true} onClose={vi.fn()} isReviewPage={true} />);

    expect(screen.queryByText('shortcuts.cheatSheet.notOnReviewPage')).not.toBeInTheDocument();
  });
});
