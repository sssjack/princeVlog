import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('public home visual theme', () => {
  it('adds a public style switcher that persists the selected dark theme', () => {
    expect(mainSource).toContain('const PUBLIC_THEMES');
    expect(mainSource).toContain('function StyleSwitcher');
    expect(mainSource).toContain('data-theme={theme}');
    expect(mainSource).toContain("localStorage.setItem('princevlog-public-theme'");
  });

  it('defines multiple dark artistic home themes', () => {
    expect(mainSource).toContain("id: 'nocturne'");
    expect(mainSource).toContain("label: '夜航'");
    expect(styles).toContain('.public-shell[data-theme="nocturne"]');
    expect(styles).toContain('.public-shell[data-theme="ink"]');
    expect(styles).toContain('.public-shell[data-theme="ember"]');
    expect(styles).toContain('.public-shell[data-theme="ether"]');
    expect(styles).toContain('color-scheme: dark');
    expect(styles).toContain('.style-switcher');
  });

  it('refreshes the home hero with poetic motion and data signals', () => {
    expect(mainSource).toContain('hero-signal-row');
    expect(mainSource).toContain('hero-thought-panel');
    expect(styles).toContain('.hero-section::before');
    expect(styles).toContain('.hero-signal-row');
    expect(styles).toContain('@keyframes nocturne-drift');
    expect(styles).toContain('@keyframes quiet-pulse');
    expect(styles).toContain('backdrop-filter: blur');
  });

  it('keeps public navigation compact on small screens', () => {
    expect(mainSource).toContain('aria-label="首页"');
    expect(mainSource).toContain('<Home size={17} /><span>首页</span>');
    expect(styles).toContain('.public-shell .site-header nav button span');
  });
});
