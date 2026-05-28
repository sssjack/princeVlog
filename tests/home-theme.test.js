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

  it('uses an elegant serif only for the largest home PrinceVlog title', () => {
    const heroTitleRule = styles.match(/\.public-shell \.hero-title-stage h1 \{[\s\S]*?\n\}/)?.[0] || '';
    const brandRule = styles.match(/\.brand \{[\s\S]*?\n\}/)?.[0] || '';
    const adminBrandRule = styles.match(/\.admin-brand \{[\s\S]*?\n\}/)?.[0] || '';

    expect(heroTitleRule).toContain('Cormorant Garamond');
    expect(heroTitleRule).toContain('Playfair Display');
    expect(heroTitleRule).toContain('font-weight: 500');
    expect(heroTitleRule).toContain('letter-spacing: 0.035em');
    expect(heroTitleRule).toContain('text-shadow:');
    expect(brandRule).not.toContain('Cormorant Garamond');
    expect(adminBrandRule).not.toContain('Cormorant Garamond');
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

  it('shows mottoes as fading statements inside the hero thought panel', () => {
    expect(mainSource).toContain('hero-motto-stack');
    expect(mainSource).toContain('motto-fade-stack');
    expect(mainSource).not.toContain('motto-stage');
    expect(mainSource).not.toContain('motto-track');
    expect(styles).toContain('.hero-motto-stack');
    expect(styles).toContain('@keyframes motto-fade');
    expect(styles).toContain('animation-delay: calc(var(--motto-index)');
  });

  it('keeps public navigation compact on small screens', () => {
    expect(mainSource).toContain('aria-label="首页"');
    expect(mainSource).toContain('<Home size={17} /><span>首页</span>');
    expect(styles).toContain('.public-shell .site-header nav button span');
  });

  it('replaces the GitHub nav item with an About me jump link', () => {
    const galleryIndex = mainSource.indexOf("onClick={() => navigate('/gallery')}");
    const aboutIndex = mainSource.indexOf('aria-label="About me"');
    const adminIndex = mainSource.indexOf("onClick={() => navigate('/admin')}");

    expect(galleryIndex).toBeGreaterThan(-1);
    expect(aboutIndex).toBeGreaterThan(galleryIndex);
    expect(aboutIndex).toBeLessThan(adminIndex);
    expect(mainSource).toContain('<UserRound size={17} /><span>About me</span>');
    expect(mainSource).not.toContain('aria-label="GitHub"');
  });

  it('adds a playful sunny About me section with avatar and social links', () => {
    expect(mainSource).toContain('aboutAvatarUrl');
    expect(mainSource).toContain('id="about-me"');
    expect(mainSource).toContain('阳光小简历');
    expect(mainSource).toContain('人生进度条偶尔卡顿，但我会笑着继续加载');
    expect(mainSource).toContain('https://github.com/sssjack');
    expect(mainSource).toContain('https://www.zhihu.com/people/68505a0583a497cb4f7dc67fe37869d7');
    expect(mainSource).toContain('target="_blank"');
    expect(mainSource).toContain('rel="noreferrer"');
    expect(styles).toContain('.about-me-section');
    expect(styles).toContain('.about-avatar-card');
    expect(styles).toContain('.about-social-links');
  });
});
