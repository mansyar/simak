/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadCsv } from '@/lib/download';

describe('downloadCsv', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as never);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a Blob with text/csv MIME type', () => {
    const blobSpy = vi.spyOn(globalThis, 'Blob');
    downloadCsv('a,b,c\n1,2,3', 'test.csv');
    expect(blobSpy).toHaveBeenCalledWith(['a,b,c\n1,2,3'], { type: 'text/csv;charset=utf-8;' });
  });

  it('should create an object URL from the Blob', () => {
    downloadCsv('test', 'test.csv');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('should append an anchor element to document body with correct download attribute', () => {
    downloadCsv('test', 'report.csv');

    expect(document.body.appendChild).toHaveBeenCalledTimes(1);
    const anchor = (document.body.appendChild as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as HTMLAnchorElement;
    expect(anchor).toBeInstanceOf(HTMLAnchorElement);
    expect(anchor.download).toBe('report.csv');
    expect(anchor.href).toBe('blob:mock-url');
  });

  it('should click the anchor to trigger download', () => {
    let clicked = false;
    const realCreate = document.createElement;
    document.createElement = ((tag: string) => {
      const el = realCreate.call(document, tag) as HTMLAnchorElement;
      if (tag === 'a') {
        el.click = () => {
          clicked = true;
        };
      }
      return el;
    }) as typeof document.createElement;

    downloadCsv('test', 'test.csv');

    expect(clicked).toBe(true);
    document.createElement = realCreate;
  });

  it('should revoke the object URL after download', () => {
    downloadCsv('test', 'test.csv');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should remove the anchor from document body after click', () => {
    downloadCsv('test', 'test.csv');
    expect(document.body.removeChild).toHaveBeenCalledTimes(1);
  });
});
