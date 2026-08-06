import { describe, expect, it, vi } from 'vitest';
import * as assignmentContracts from '@/server/assignments';
import * as assignmentHandlers from '@/server/assignments.server';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

const contracts = assignmentContracts as Record<string, unknown>;
const handlers = assignmentHandlers as Record<string, unknown>;

type SchemaLike = {
  parse: (value: unknown) => Record<string, unknown>;
};

describe('assignment clone and rollover contracts', () => {
  it('requires an absolute target deadline and defaults to no copied students', () => {
    const schema = contracts.CloneAssignmentSchema as SchemaLike | undefined;
    expect(schema).toBeDefined();
    if (!schema) return;

    const parsed = schema.parse({
      sourceAssignmentId: 10,
      targetSectionId: 20,
      finalDeadline: new Date('2030-06-01T00:00:00.000Z'),
    });

    expect(parsed).toMatchObject({
      sourceAssignmentId: 10,
      targetSectionId: 20,
      studentIds: [],
    });
    expect(() =>
      schema.parse({
        sourceAssignmentId: 10,
        targetSectionId: 20,
        relativeDeadlineDays: 30,
      }),
    ).toThrow();
  });

  it('exposes clone and semester rollover client-safe stubs', () => {
    expect(typeof contracts.cloneAssignment).toBe('function');
    expect(typeof contracts.rolloverAssignment).toBe('function');
  });

  it('exposes server handlers for both operations', () => {
    expect(typeof handlers.cloneAssignmentHandler).toBe('function');
    expect(typeof handlers.rolloverAssignmentHandler).toBe('function');
  });
});
