import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

describe('Tabs', () => {
  it('renders tabs with default value', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Content 1')).toBeDefined();
    expect(screen.queryByText('Content 2')).toBeNull();
  });

  it('switches tabs on click', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );
    fireEvent.click(screen.getByText('Tab 2'));
    expect(screen.getByText('Content 2')).toBeDefined();
    expect(screen.queryByText('Content 1')).toBeNull();
  });

  it('calls onValueChange when tab is clicked', () => {
    const handleChange = vi.fn();
    render(
      <Tabs defaultValue="tab1" onValueChange={handleChange}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );
    fireEvent.click(screen.getByText('Tab 2'));
    expect(handleChange).toHaveBeenCalledWith('tab2');
  });

  it('works in controlled mode', () => {
    const { rerender } = render(
      <Tabs value="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Content 1')).toBeDefined();

    rerender(
      <Tabs value="tab2">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Content 2')).toBeDefined();
    expect(screen.queryByText('Content 1')).toBeNull();
  });

  it('sets aria-selected on active tab', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const tab1 = screen.getByText('Tab 1');
    const tab2 = screen.getByText('Tab 2');
    expect(tab1.getAttribute('aria-selected')).toBe('true');
    expect(tab2.getAttribute('aria-selected')).toBe('false');
  });

  it('sets data-state on active tab', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const tab1 = screen.getByText('Tab 1');
    expect(tab1.getAttribute('data-state')).toBe('active');
  });

  it('renders tablist with role', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(screen.getByRole('tablist')).toBeDefined();
  });

  it('renders tab panels with role', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tabpanel')).toBeDefined();
  });
});
