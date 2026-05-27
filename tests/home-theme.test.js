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

  it('adds bright public themes alongside the existing dark styles', () => {
    expect(mainSource).toContain("id: 'lumen'");
    expect(mainSource).toContain("label: '晨光'");
    expect(mainSource).toContain("id: 'paper'");
    expect(mainSource).toContain("label: '纸境'");
    expect(styles).toContain('.public-shell[data-theme="lumen"]');
    expect(styles).toContain('.public-shell[data-theme="paper"]');
    expect(styles).toContain('color-scheme: light');
  });

  it('centers the home title and places primary functions below it', () => {
    expect(mainSource).toContain('hero-title-stage');
    expect(mainSource).toContain('hero-primary-panel');
    expect(mainSource.indexOf('hero-title-stage')).toBeLessThan(mainSource.indexOf('hero-primary-panel'));
    expect(styles).toContain('.hero-title-stage');
    expect(styles).toContain('.hero-primary-panel');
    expect(styles).toContain('text-align: center');
    expect(styles).toContain('--display-font');
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
