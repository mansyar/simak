import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccessibilitySection } from '@/components/settings/AccessibilitySection';
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockMutateAsync = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args) => mockUseQuery(...args),
  useMutation: (...args) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/server/settings', () => ({
  getCurrentUser: { url: '/api/settings/current-user' },
  updateUserSettings: { url: '/api/settings/update-settings' },
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'settings.accessibility.title': 'Accessibility',
        'settings.accessibility.description': 'Accessibility settings for a better experience',
        'settings.accessibility.reducedMotionLabel': 'Reduced Motion',
        'settings.accessibility.reducedMotionHint':
          'Reduce animations and transitions throughout the app',
      };
      return translations[key] || key;
    },
  }),
}));
describe('AccessibilitySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });
  it('should render reduced motion label and hint', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John', email: 'john@test.com', image: null },
        settings: { reducedMotion: false },
      },
      isLoading: false,
    });
    render(_jsx(AccessibilitySection, {}));
    expect(screen.getByText('Reduced Motion')).toBeDefined();
    expect(screen.getByText('Reduce animations and transitions throughout the app')).toBeDefined();
  });
  it('should show reduced motion toggle as unchecked when false', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John', email: 'john@test.com', image: null },
        settings: { reducedMotion: false },
      },
      isLoading: false,
    });
    render(_jsx(AccessibilitySection, {}));
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.checked).toBe(false);
  });
  it('should show reduced motion toggle as checked when true', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John', email: 'john@test.com', image: null },
        settings: { reducedMotion: true },
      },
      isLoading: false,
    });
    render(_jsx(AccessibilitySection, {}));
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.checked).toBe(true);
  });
  it('should call updateUserSettings mutation when toggle is clicked', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John', email: 'john@test.com', image: null },
        settings: { reducedMotion: false },
      },
      isLoading: false,
    });
    mockMutateAsync.mockResolvedValue({ reducedMotion: true });
    render(_jsx(AccessibilitySection, {}));
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(mockMutateAsync).toHaveBeenCalledWith({ reducedMotion: true });
  });
  it('should render loading state', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: true });
    render(_jsx(AccessibilitySection, {}));
    expect(screen.getByText('common.loading')).toBeDefined();
  });
  it('should default to false when settings are null', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John', email: 'john@test.com', image: null },
        settings: null,
      },
      isLoading: false,
    });
    render(_jsx(AccessibilitySection, {}));
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.checked).toBe(false);
  });
});
