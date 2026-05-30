import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileSection } from '@/components/settings/ProfileSection';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock('@/server/settings', () => ({
  getCurrentUser: { url: '/api/settings/current-user' },
  updateProfile: { url: '/api/settings/update-profile' },
  getPresignedAvatarUploadUrl: { url: '/api/settings/avatar-upload-url' },
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.profile.title': 'Profile',
        'settings.profile.nameLabel': 'Name',
        'settings.profile.emailLabel': 'Email',
        'settings.profile.avatarLabel': 'Profile Picture',
        'settings.profile.saveName': 'Save Name',
        'settings.profile.nameSuccess': 'Name updated successfully',
        'settings.profile.nameError': 'Failed to update name',
        'common.save': 'Save',
      };
      return translations[key] || key;
    },
  }),
}));

describe('ProfileSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  it('should render user name, email, and avatar', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John Doe', email: 'john@test.com', image: null },
        settings: null,
      },
      isLoading: false,
    });

    render(<ProfileSection />);

    expect(screen.getByDisplayValue('John Doe')).toBeDefined();
    expect(screen.getByText('john@test.com')).toBeDefined();
    expect(screen.getByLabelText('Profile Picture')).toBeDefined();
  });

  it('should render loading state', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: true });

    render(<ProfileSection />);

    expect(screen.getByText('common.loading')).toBeDefined();
  });

  it('should update name via mutation when Save is clicked', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John', email: 'john@test.com', image: null },
        settings: null,
      },
      isLoading: false,
    });
    mockMutateAsync.mockResolvedValue({ name: 'John Updated' });

    render(<ProfileSection />);

    const input = screen.getByDisplayValue('John');
    fireEvent.change(input, { target: { value: 'John Updated' } });

    const saveButton = screen.getByText('Save Name');
    fireEvent.click(saveButton);

    expect(mockMutateAsync).toHaveBeenCalledWith({ name: 'John Updated' });
  });

  it('should show success message after name update', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John', email: 'john@test.com', image: null },
        settings: null,
      },
      isLoading: false,
    });
    mockMutateAsync.mockResolvedValue({ name: 'John Updated' });

    render(<ProfileSection />);

    const input = screen.getByDisplayValue('John');
    fireEvent.change(input, { target: { value: 'John Updated' } });
    fireEvent.click(screen.getByText('Save Name'));

    expect(await screen.findByText('Name updated successfully')).toBeDefined();
  });

  it('should show error message on failed name update', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John', email: 'john@test.com', image: null },
        settings: null,
      },
      isLoading: false,
    });
    mockMutateAsync.mockRejectedValue(new Error('Failed'));

    render(<ProfileSection />);

    const input = screen.getByDisplayValue('John');
    fireEvent.change(input, { target: { value: 'John Updated' } });
    fireEvent.click(screen.getByText('Save Name'));

    expect(await screen.findByText('Failed to update name')).toBeDefined();
  });

  it('should render initials fallback when no image', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John Doe', email: 'john@test.com', image: null },
        settings: null,
      },
      isLoading: false,
    });

    render(<ProfileSection />);

    expect(screen.getByText('JD')).toBeDefined();
  });

  it('should render avatar image when image is present', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: {
          id: '1',
          name: 'John',
          email: 'john@test.com',
          image: 'https://example.com/avatar.jpg',
        },
        settings: null,
      },
      isLoading: false,
    });

    render(<ProfileSection />);

    const img = screen.getByAltText('John') as HTMLImageElement;
    expect(img).toBeDefined();
    expect(img.src).toBe('https://example.com/avatar.jpg');
  });
});
