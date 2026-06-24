import { read, utils } from 'xlsx';
import { CREATION_ALLOWED_ROLES } from '../role-permissions';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ['admin', 'instructor', 'student'] as const;
const MAX_ROWS = 500;
const REQUIRED_HEADERS = ['name', 'email', 'role'] as const;

export interface ParsedUserRow {
  name: string;
  email: string;
  role: string;
  status: 'valid' | 'invalid';
  error?: string;
}

export interface ParseUsersResult {
  rows: ParsedUserRow[];
  errors: string[];
}

/**
 * Parse a .xlsx file containing user rows.
 * Headers must be exactly: name | email | role.
 * Whitespace is trimmed; email and role are lowercased.
 * Each row is validated: name non-empty, email format, role valid + creatable by actor.
 * Max 500 rows (excluding header).
 */
export async function parseUsersXlsx(file: File, actorRole: string): Promise<ParseUsersResult> {
  const errors: string[] = [];
  const rows: ParsedUserRow[] = [];

  const arrayBuf = await file.arrayBuffer();
  const wb = read(arrayBuf, { type: 'array' });

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    errors.push('File contains no sheets');
    return { rows, errors };
  }

  const ws = wb.Sheets[sheetName];
  const data = utils.sheet_to_json<string[]>(ws, { header: 1 });

  if (data.length === 0) {
    errors.push('File is empty');
    return { rows, errors };
  }

  // Validate headers
  const headers = (data[0] ?? []).map((h) => String(h).trim().toLowerCase());
  const requiredSet = new Set(REQUIRED_HEADERS);
  const headerSet = new Set(headers);

  for (const required of REQUIRED_HEADERS) {
    if (!headerSet.has(required)) {
      errors.push(`Missing required header: "${required}"`);
    }
  }

  // Reject unknown headers
  for (const h of headers) {
    if (h && !requiredSet.has(h as (typeof REQUIRED_HEADERS)[number])) {
      errors.push(`Unknown header: "${h}"`);
    }
  }

  if (errors.length > 0) {
    return { rows, errors };
  }

  const dataRows = data.slice(1);

  // Row-limit check
  if (dataRows.length > MAX_ROWS) {
    errors.push(`File exceeds ${MAX_ROWS} row limit (${dataRows.length} data rows found)`);
    return { rows, errors };
  }

  const allowedRoles = CREATION_ALLOWED_ROLES[actorRole];

  for (let i = 0; i < dataRows.length; i++) {
    const raw = dataRows[i] ?? [];
    const name = String(raw[0] ?? '').trim();
    const email = String(raw[1] ?? '')
      .trim()
      .toLowerCase();
    const role = String(raw[2] ?? '')
      .trim()
      .toLowerCase();

    // Validate name
    if (!name) {
      rows.push({ name, email, role, status: 'invalid', error: 'Name is required' });
      continue;
    }

    // Validate email format
    if (!EMAIL_RE.test(email)) {
      rows.push({ name, email, role, status: 'invalid', error: 'Invalid email format' });
      continue;
    }

    // Validate role enum
    if (!(VALID_ROLES as readonly string[]).includes(role)) {
      rows.push({
        name,
        email,
        role,
        status: 'invalid',
        error: `Invalid role: "${role}". Must be one of: admin, instructor, student`,
      });
      continue;
    }

    // Validate role-permission (superadmin never creatable via import)
    if (role === 'superadmin') {
      rows.push({
        name,
        email,
        role,
        status: 'invalid',
        error: 'Superadmin cannot be created via import',
      });
      continue;
    }

    // Validate actor permission
    if (!allowedRoles || !allowedRoles.includes(role)) {
      rows.push({
        name,
        email,
        role,
        status: 'invalid',
        error: `Actor "${actorRole}" is not allowed to create role "${role}"`,
      });
      continue;
    }

    rows.push({ name, email, role, status: 'valid' });
  }

  return { rows, errors };
}
