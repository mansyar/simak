import { vi, Mock } from 'vitest';

export type FakeStatus = 'pending' | 'processing' | 'sent' | 'failed';

export interface FakeRow {
  id: number;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  templateType: string;
  status: FakeStatus;
  attempts: number | null;
  lastAttemptAt: Date | null;
  errorMessage: string | null;
  resendMessageId: string | null;
  createdAt: Date;
}

export interface CallRecord {
  method: string;
  args: any[];
}

export interface MockDb {
  select: Mock;
  from: Mock;
  where: Mock;
  orderBy: Mock;
  limit: Mock;
  for: Mock;
  update: Mock;
  set: Mock;
  then: Mock;
  transaction: Mock;
  calls: CallRecord[];
  getRows: () => FakeRow[];
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function compareValues(a: any, b: any, op: string): boolean {
  const aVal = a instanceof Date ? a.getTime() : a;
  const bVal = b instanceof Date ? b.getTime() : b;
  if (op === '=') return aVal === bVal;
  if (op === '<') return aVal < bVal;
  if (op === '>') return aVal > bVal;
  return true;
}

export function evaluateCondition(condition: any, row: FakeRow): boolean {
  const chunks = condition?.queryChunks;
  if (!chunks) return true;

  if (chunks.length === 3 && chunks[0]?.value?.[0] === '(' && chunks[2]?.value?.[0] === ')') {
    return evaluateCondition(chunks[1], row);
  }

  if (chunks.length === 3) {
    const joiner: string | undefined = chunks[1]?.value?.[0];
    if (typeof joiner === 'string') {
      const left = evaluateCondition(chunks[0], row);
      const right = evaluateCondition(chunks[2], row);
      if (joiner.includes(' and ')) return left && right;
      if (joiner.includes(' or ')) return left || right;
    }
  }

  if (chunks.length === 5) {
    const left = chunks[1];
    const opRaw: string | undefined = chunks[2]?.value?.[0];
    const right = chunks[3]?.value;
    const op = typeof opRaw === 'string' ? opRaw.trim() : undefined;
    if (left?.name && op) {
      const rowVal = (row as any)[snakeToCamel(left.name)];
      return compareValues(rowVal, right, op);
    }
  }

  return true;
}

export function createMockDb(rows: FakeRow[] = []): MockDb {
  let currentRows: FakeRow[] = [];
  let pendingSetValues: any = null;
  let isUpdateChain = false;
  const calls: CallRecord[] = [];

  const mockDb: Record<string, any> = {
    select: vi.fn(() => {
      isUpdateChain = false;
      calls.push({ method: 'select', args: [] });
      return mockDb;
    }),
    from: vi.fn((table) => {
      calls.push({ method: 'from', args: [table] });
      currentRows = [...rows];
      return mockDb;
    }),
    where: vi.fn((condition) => {
      calls.push({ method: 'where', args: [condition] });
      currentRows = currentRows.filter((row) => evaluateCondition(condition, row));
      if (pendingSetValues !== null) {
        currentRows.forEach((row) => Object.assign(row, pendingSetValues));
        pendingSetValues = null;
      }
      return mockDb;
    }),
    orderBy: vi.fn((col) => {
      calls.push({ method: 'orderBy', args: [col] });
      currentRows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return mockDb;
    }),
    limit: vi.fn((n) => {
      calls.push({ method: 'limit', args: [n] });
      currentRows = currentRows.slice(0, n);
      return mockDb;
    }),
    for: vi.fn((...args) => {
      calls.push({ method: 'for', args });
      return mockDb;
    }),
    update: vi.fn((table) => {
      calls.push({ method: 'update', args: [table] });
      pendingSetValues = null;
      isUpdateChain = true;
      currentRows = [...rows];
      return mockDb;
    }),
    set: vi.fn((values) => {
      calls.push({ method: 'set', args: [values] });
      pendingSetValues = values;
      return mockDb;
    }),
    then: vi.fn((onFulfilled) => {
      const result = isUpdateChain ? { rowCount: currentRows.length } : currentRows;
      return Promise.resolve(result).then(onFulfilled);
    }),
    transaction: vi.fn(async (callback) => {
      calls.push({ method: 'transaction-start', args: [] });
      const result = await callback(mockDb);
      calls.push({ method: 'transaction-end', args: [] });
      return result;
    }),
  };

  mockDb.calls = calls;
  mockDb.getRows = () => rows;

  return mockDb as MockDb;
}

export function makeEmail(
  overrides: Partial<{
    id: number;
    recipientEmail: string;
    subject: string;
    bodyHtml: string;
    templateType: string;
    status: FakeStatus;
    attempts: number | null;
    lastAttemptAt: Date | null;
    errorMessage: string | null;
    resendMessageId: string | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: 1,
    recipientEmail: 'user@test.com',
    subject: 'Test Email',
    bodyHtml: '<p>Hello</p>',
    templateType: 'invitation',
    status: 'pending' as FakeStatus,
    attempts: 0,
    lastAttemptAt: null,
    errorMessage: null,
    resendMessageId: null,
    createdAt: new Date('2026-05-30T00:00:00Z'),
    ...overrides,
  };
}
