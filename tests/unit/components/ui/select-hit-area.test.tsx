/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Select, SelectTrigger } from '@/components/ui/select';

describe('SelectTrigger touch targets', () => {
  it('uses a 44px minimum height for default and compact filter triggers', () => {
    render(
      <Select>
        <SelectTrigger size="default">All assignments</SelectTrigger>
        <SelectTrigger size="sm">All statuses</SelectTrigger>
      </Select>,
    );

    screen.getAllByRole('combobox').forEach((trigger) => {
      expect(trigger.className).toContain('min-h-11');
    });
  });
});
