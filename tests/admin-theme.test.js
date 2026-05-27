import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('admin theme shell', () => {
  it('exposes the responsive admin navigation controls', () => {
    expect(mainSource).toContain('admin-mobile-bar');
    expect(mainSource).toContain('admin-user-panel');
    expect(mainSource).toContain('aria-label="切换后台导航"');
  });

  it('defines the lithe-inspired admin surface and mobile rules', () => {
    expect(styles).toContain('--admin-primary: #8e51ff');
    expect(styles).toContain('.admin-shell::before');
    expect(styles).toContain('backdrop-filter: blur');
    expect(styles).toContain('@media (max-width: 760px)');
    expect(styles).toContain('.admin-nav.is-open');
  });
});
