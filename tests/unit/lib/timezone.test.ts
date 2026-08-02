import { describe, expect, it } from 'vitest';

import { isValidTimeZone, resolveTimeZone } from '@/lib/timezone';

describe('timezone helpers', () => {
  describe('isValidTimeZone', () => {
    it('accepts supported IANA zones and UTC', () => {
      expect(isValidTimeZone('America/New_York')).toBe(true);
      expect(isValidTimeZone('Asia/Jakarta')).toBe(true);
      expect(isValidTimeZone('UTC')).toBe(true);
    });

    it.each([undefined, null, '', 'Mars/Phobos', 42, {}, []])(
      'rejects unsupported or non-string values: %p',
      (value) => {
        expect(isValidTimeZone(value)).toBe(false);
      },
    );
  });

  describe('resolveTimeZone', () => {
    it('prefers a valid saved timezone over browser detection', () => {
      expect(resolveTimeZone('Asia/Jakarta', 'America/New_York')).toBe('Asia/Jakarta');
    });

    it('uses a valid detected timezone when the saved value is unavailable', () => {
      expect(resolveTimeZone(undefined, 'America/New_York')).toBe('America/New_York');
    });

    it('falls back to UTC when saved and detected values are invalid', () => {
      expect(resolveTimeZone('Mars/Phobos', 'Etc/Nowhere')).toBe('UTC');
    });

    it('falls back to UTC when no timezone values are available', () => {
      expect(resolveTimeZone()).toBe('UTC');
    });
  });
});
