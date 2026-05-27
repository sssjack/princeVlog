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

  it('keeps admin management pages list-first with modal create flows', () => {
    expect(mainSource).toContain('function AdminModal');
    expect(mainSource).toContain('function AdminToolbar');
    expect(mainSource).toContain('modalMode');
    expect(mainSource).toContain('admin-modal-backdrop');
    expect(styles).toContain('.admin-toolbar');
    expect(styles).toContain('.admin-modal');
  });

  it('supports batch photo creation and analytics visualizations', () => {
    expect(mainSource).toContain('multiple');
    expect(mainSource).toContain('selectedPhotoFiles');
    expect(mainSource).toContain('Promise.all(selectedPhotoFiles.map');
    expect(mainSource).toContain('function AdminTrendChart');
    expect(mainSource).toContain('function AdminBarChart');
    expect(styles).toContain('.analytics-visual-grid');
    expect(styles).toContain('.trend-chart');
  });

  it('shows country, province and second-level timestamps for the latest 50 visits', () => {
    expect(mainSource).toContain('function formatDateTime');
    expect(mainSource).toContain("subtitle=\"请求量、访客、国家、省份和最近 50 条访问记录。\"");
    expect(mainSource).toContain("columns={['ip', 'country', 'province', 'path', 'createdAt']}");
    expect(mainSource).toContain("column === 'createdAt' ? formatDateTime(row[column])");
  });
});
