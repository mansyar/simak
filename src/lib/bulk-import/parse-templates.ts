import { read, utils } from 'xlsx';

const MAX_ROWS = 500;
const REQUIRED_HEADERS = [
  'templatename',
  'type',
  'checkpointname',
  'minconsultations',
  'estimatedduration',
] as const;

export interface ParsedCheckpoint {
  name: string;
  minConsultations: number;
  estimatedDuration: number;
}

export interface ParsedTemplateGroup {
  templateName: string;
  type: string;
  checkpoints: ParsedCheckpoint[];
  status: 'valid' | 'invalid';
  error?: string;
}

export interface ParseTemplatesResult {
  groups: ParsedTemplateGroup[];
  errors: string[];
}

/**
 * Parse a .xlsx file containing template rows.
 * Headers must be exactly: templateName | type | checkpointName | minConsultations | estimatedDuration.
 * Rows sharing the same templateName are grouped into one template.
 * minConsultations defaults to 0, estimatedDuration defaults to 7 when blank.
 * Each group is validated: name/type non-empty + consistent, ≥1 checkpoint, checkpoint names non-empty, numeric fields valid.
 * Max 500 checkpoint rows (excluding header).
 */
export async function parseTemplatesXlsx(file: File): Promise<ParseTemplatesResult> {
  const errors: string[] = [];
  const groups: ParsedTemplateGroup[] = [];

  const arrayBuf = await file.arrayBuffer();
  const wb = read(arrayBuf, { type: 'array' });

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    errors.push('File contains no sheets');
    return { groups, errors };
  }

  const ws = wb.Sheets[sheetName];
  const data = utils.sheet_to_json<string[]>(ws, { header: 1 });

  if (data.length === 0) {
    errors.push('File is empty');
    return { groups, errors };
  }

  // Validate headers
  const headers = (data[0] ?? []).map((h) => String(h).trim().toLowerCase());
  const headerSet = new Set(headers);

  for (const required of REQUIRED_HEADERS) {
    if (!headerSet.has(required)) {
      errors.push(`Missing required header: "${required}"`);
    }
  }

  if (errors.length > 0) {
    return { groups, errors };
  }

  const dataRows = data.slice(1);

  // Row-limit check
  if (dataRows.length > MAX_ROWS) {
    errors.push(`File exceeds ${MAX_ROWS} row limit (${dataRows.length} checkpoint rows found)`);
    return { groups, errors };
  }

  // Group rows by templateName
  const groupMap = new Map<
    string,
    { templateName: string; type: string; checkpoints: ParsedCheckpoint[] }
  >();

  for (const raw of dataRows) {
    const templateName = String(raw[0] ?? '').trim();
    const type = String(raw[1] ?? '').trim();
    const checkpointName = String(raw[2] ?? '').trim();
    const minConsultationsRaw = String(raw[3] ?? '').trim();
    const estimatedDurationRaw = String(raw[4] ?? '').trim();

    if (!templateName) continue;

    let group = groupMap.get(templateName);
    if (!group) {
      group = { templateName, type, checkpoints: [] };
      groupMap.set(templateName, group);
    }

    // Validate checkpoint
    if (!checkpointName) {
      groups.push({
        templateName,
        type: group.type,
        checkpoints: [],
        status: 'invalid',
        error: 'Checkpoint name is required',
      });
      continue;
    }

    const minConsultations = minConsultationsRaw === '' ? 0 : Number(minConsultationsRaw);
    const estimatedDuration = estimatedDurationRaw === '' ? 7 : Number(estimatedDurationRaw);

    if (Number.isNaN(minConsultations) || !Number.isInteger(minConsultations)) {
      groups.push({
        templateName,
        type: group.type,
        checkpoints: [],
        status: 'invalid',
        error: `Invalid minConsultations value: "${minConsultationsRaw}"`,
      });
      continue;
    }

    if (Number.isNaN(estimatedDuration) || !Number.isInteger(estimatedDuration)) {
      groups.push({
        templateName,
        type: group.type,
        checkpoints: [],
        status: 'invalid',
        error: `Invalid estimatedDuration value: "${estimatedDurationRaw}"`,
      });
      continue;
    }

    group.checkpoints.push({ name: checkpointName, minConsultations, estimatedDuration });
  }

  // Validate groups and build final result
  for (const [, group] of groupMap) {
    if (!group.type) {
      groups.push({
        templateName: group.templateName,
        type: '',
        checkpoints: group.checkpoints,
        status: 'invalid',
        error: 'Type is required',
      });
      continue;
    }

    // Check type consistency (all rows in group must have same type)
    const seenTypes = new Set<string>();
    for (const raw of dataRows) {
      const tn = String(raw[0] ?? '').trim();
      const tp = String(raw[1] ?? '').trim();
      if (tn === group.templateName && tp) {
        seenTypes.add(tp);
      }
    }

    if (seenTypes.size > 1) {
      groups.push({
        templateName: group.templateName,
        type: group.type,
        checkpoints: group.checkpoints,
        status: 'invalid',
        error: `Inconsistent type across rows: ${[...seenTypes].join(', ')}`,
      });
      continue;
    }

    if (group.checkpoints.length === 0) {
      groups.push({
        templateName: group.templateName,
        type: group.type,
        checkpoints: [],
        status: 'invalid',
        error: 'At least one checkpoint is required',
      });
      continue;
    }

    groups.push({
      templateName: group.templateName,
      type: group.type,
      checkpoints: group.checkpoints,
      status: 'valid',
    });
  }

  return { groups, errors };
}
