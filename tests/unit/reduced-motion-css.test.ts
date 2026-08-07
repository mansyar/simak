import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const globalCss = readFileSync(resolve(process.cwd(), 'src/app/global.css'), 'utf8');

describe('global reduced-motion contract', () => {
  it('applies the preference to the whole document, not only toasts', () => {
    expect(globalCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globalCss).toContain(":root[data-reduced-motion='true']");
    expect(globalCss).toContain('animation-duration: 0.01ms');
    expect(globalCss).toContain('transition-duration: 0.01ms');
    expect(globalCss).toContain('scroll-behavior: auto');
  });
});
