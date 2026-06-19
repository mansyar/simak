import { describe, it, expect } from 'vitest';
import en from '../../../locales/en.json';
import id from '../../../locales/id.json';
function deepKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return deepKeys(value, fullKey);
    }
    return [fullKey];
  });
}
describe('Translation coverage', () => {
  it('should have all English keys present in Indonesian translations', () => {
    const enKeys = deepKeys(en);
    const idKeys = deepKeys(id);
    const missing = enKeys.filter((key) => !idKeys.includes(key));
    if (missing.length > 0) {
      console.log('Missing keys in id.json:', missing);
    }
    expect(missing).toHaveLength(0);
  });
  it('should produce the same number of keys for both locales', () => {
    const enKeys = deepKeys(en);
    const idKeys = deepKeys(id);
    expect(enKeys.length).toBe(idKeys.length);
  });
});
