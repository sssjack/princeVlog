import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createAnnualTimeline, extractArticleTimelineEvents } from '../server/timeline.js';

const mainSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('annual article timeline', () => {
  it('extracts dated events from annual review articles', () => {
    const article = {
      id: 'a-2023',
      title: '这一年--我的2023',
      slug: 'year-2023',
      excerpt: '年度复盘',
      status: 'published',
      content: [
        '# 这一年--我的2023',
        '## 一年的路程',
        '1月1日，和朋友广州游，新的一年，让人充满期待。',
        '2月中旬，我开始准备新的考试计划。',
        '这不是时间点，只是普通段落。'
      ].join('\n')
    };

    const events = extractArticleTimelineEvents(article);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      date: '2023-01-01',
      dateLabel: '1月1日',
      precision: 'day',
      title: '和朋友广州游，新的一年，让人充满期待',
      articleSlug: 'year-2023'
    });
    expect(events[1]).toMatchObject({
      date: '2023-02-15',
      dateLabel: '2月中旬',
      precision: 'period'
    });
    expect(events[1].detail).toContain('考试计划');
  });

  it('groups annual events by year in reverse chronological order', () => {
    const timeline = createAnnualTimeline([
      {
        id: 'other',
        title: '欢迎来到 PrinceVlog',
        slug: 'welcome',
        status: 'published',
        content: '1月1日，普通文章不进入年度时间轴。'
      },
      {
        id: 'a-2022',
        title: '这一年--我的2022',
        slug: 'year-2022',
        excerpt: '2022 复盘',
        status: 'published',
        content: '2022年5月4日，坐上通往深圳的航班。'
      },
      {
        id: 'a-2024',
        title: '这一年--我的2024',
        slug: 'year-2024',
        excerpt: '2024 复盘',
        status: 'published',
        content: '7月，开始认真处理人生的新问题。'
      }
    ]);

    expect(timeline.totalEvents).toBe(2);
    expect(timeline.years.map((group) => group.year)).toEqual([2024, 2022]);
    expect(timeline.years[0].events[0]).toMatchObject({
      date: '2024-07-01',
      precision: 'month',
      articleTitle: '这一年--我的2024'
    });
  });

  it('renders a public timeline section with animated event details', () => {
    expect(mainSource).toContain("path === '/timeline'");
    expect(mainSource).toContain('function YearTimelineExperience');
    expect(mainSource).toContain("api('/public/timeline')");
    expect(mainSource).toContain('timeline-event-detail');
    expect(mainSource).toContain('function DeepSeekAnnualInsight');
    expect(mainSource).toContain('timeline-insight-panel');
    expect(styles).toContain('.timeline-band');
    expect(styles).toContain('.timeline-constellation');
    expect(styles).toContain('.timeline-insight-panel');
    expect(styles).toContain('@keyframes timeline-scan');
  });
});
