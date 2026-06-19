import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
describe('LanguageSwitcher', () => {
  it('should render EN and ID buttons', () => {
    const onSwitch = vi.fn();
    render(_jsx(LanguageSwitcher, { currentLocale: 'en', onSwitch: onSwitch }));
    expect(screen.getByText('EN')).toBeDefined();
    expect(screen.getByText('ID')).toBeDefined();
  });
  it('should call onSwitch with "id" when ID button is clicked', async () => {
    const onSwitch = vi.fn();
    const user = userEvent.setup();
    render(_jsx(LanguageSwitcher, { currentLocale: 'en', onSwitch: onSwitch }));
    await user.click(screen.getByText('ID'));
    expect(onSwitch).toHaveBeenCalledWith('id');
  });
  it('should call onSwitch with "en" when EN button is clicked', async () => {
    const onSwitch = vi.fn();
    const user = userEvent.setup();
    render(_jsx(LanguageSwitcher, { currentLocale: 'id', onSwitch: onSwitch }));
    await user.click(screen.getByText('EN'));
    expect(onSwitch).toHaveBeenCalledWith('en');
  });
});
