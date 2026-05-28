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
        '4月，与此同时，熊哥继大半年没上班后默默参加了研究生考试，并且笔试过了国家线1分成功进入复试。',
        '这不是时间点，只是普通段落。'
      ].join('\n')
    };

    const events = extractArticleTimelineEvents(article);

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      date: '2023-04-01',
      dateLabel: '4月',
      precision: 'month',
      title: '与此同时，熊哥继大半年没上班后默默参加了研究生考试，并且笔试过了国家线1分成功进入复试',
      articleSlug: 'year-2023'
    });
    expect(events[1]).toMatchObject({
      date: '2023-02-15',
      dateLabel: '2月中旬',
      precision: 'period'
    });
    expect(events[1].detail).toContain('考试计划');
    expect(events[2]).toMatchObject({
      date: '2023-01-01',
      dateLabel: '1月1日',
      precision: 'day',
      title: '和朋友广州游，新的一年，让人充满期待',
      articleSlug: 'year-2023'
    });
  });

  it('groups annual events by year and event date in reverse chronological order', () => {
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
        content: '1月，春节后重新整理计划。\n7月，开始认真处理人生的新问题。'
      }
    ]);

    expect(timeline.totalEvents).toBe(3);
    expect(timeline.years.map((group) => group.year)).toEqual([2024, 2022]);
    expect(timeline.years[0].events.map((event) => event.date)).toEqual(['2024-07-01', '2024-01-01']);
    expect(timeline.years[0].events[0]).toMatchObject({
      date: '2024-07-01',
      precision: 'month',
      articleTitle: '这一年--我的2024'
    });
  });

  it('supports year-only anticipation nodes for future annual pages', () => {
    const timeline = createAnnualTimeline([{
      id: 'a-2026',
      title: '这一年--我的2026',
      slug: 'year-2026',
      excerpt: '2026 占位',
      status: 'published',
      content: '2026，敬请期待。。。。。。'
    }]);

    expect(timeline.totalEvents).toBe(1);
    expect(timeline.years[0].year).toBe(2026);
    expect(timeline.years[0].events[0]).toMatchObject({
      date: '2026-12-31',
      dateLabel: '2026',
      precision: 'year',
      title: '敬请期待'
    });
  });

  it('applies AI-polished event titles from the cached title map', () => {
    const rawTimeline = createAnnualTimeline([{
      id: 'a-2025',
      title: '这一年--我的2025',
      slug: 'year-2025',
      excerpt: '2025 复盘',
      status: 'published',
      content: '4月，与此同时，熊哥继大半年没上班后默默参加了研究生考试，并且笔试过了国家线1分成功进入复试。'
    }]);
    const eventId = rawTimeline.years[0].events[0].id;
    const polishedTimeline = createAnnualTimeline([{
      id: 'a-2025',
      title: '这一年--我的2025',
      slug: 'year-2025',
      excerpt: '2025 复盘',
      status: 'published',
      content: '4月，与此同时，熊哥继大半年没上班后默默参加了研究生考试，并且笔试过了国家线1分成功进入复试。'
    }], {
      titleOverrides: {
        [eventId]: '熊哥考研过线进入复试'
      }
    });

    expect(polishedTimeline.years[0].events[0]).toMatchObject({
      id: eventId,
      title: '熊哥考研过线进入复试'
    });
    expect(polishedTimeline.years[0].events[0].detail).toContain('国家线1分');
  });

  it('keeps fallback titles readable when the date appears inside the phrase', () => {
    const events = extractArticleTimelineEvents({
      id: 'a-2023',
      title: '这一年--我的2023',
      slug: 'year-2023',
      excerpt: '2023 复盘',
      status: 'published',
      content: [
        '12月中旬的一天，上家公司的赔偿和工资到手，从这天起，今年的存款目标正式达成！',
        '第一份工作是4月份的客服，这也是我人生中第一份工作。'
      ].join('\n')
    });

    expect(events.map((event) => event.title)).toEqual([
      '上家公司的赔偿和工资到手，从这天起，今年的存款目标正式达成',
      '第一份工作是4月份的客服，这也是我人生中第一份工作'
    ]);
  });

  it('excludes world and society context sections from the personal timeline', () => {
    const timeline = createAnnualTimeline([{
      id: 'a-2019',
      title: '这一年--我的2019',
      slug: 'year-2019',
      excerpt: '2019 复盘',
      status: 'published',
      content: [
        '## 工作方面',
        '12月上旬，进入某公司的推广部，开始依赖大公司发展。',
        '## 九、这一年，我所处的世界',
        '4月10日21点整，天文学家宣布首次直接拍摄到黑洞的照片。',
        '这年5月，华为被美国列入黑名单。',
        '## 总结',
        '这一年仍然要继续向前。'
      ].join('\n')
    }]);

    expect(timeline.totalEvents).toBe(1);
    expect(timeline.years[0].events).toHaveLength(1);
    expect(timeline.years[0].events[0]).toMatchObject({
      date: '2019-12-05',
      title: '进入某公司的推广部，开始依赖大公司发展'
    });
    expect(timeline.years[0].events.map((event) => event.detail).join('\n')).not.toContain('黑洞');
    expect(timeline.years[0].events.map((event) => event.detail).join('\n')).not.toContain('华为被美国列入黑名单');
  });

  it('skips public technology news even when it appears outside a context section', () => {
    const timeline = createAnnualTimeline([{
      id: 'a-2024',
      title: '这一年--我的2024',
      slug: 'year-2024',
      excerpt: '2024 复盘',
      status: 'published',
      content: [
        '10月13日，SpaceX 星舰从得克萨斯州南部的博卡奇卡基地发射升空，火箭姿态失稳并开始旋转。',
        '10月22日，做完最后的交接，拿到了赔偿金，结束了我在深圳的最后一份工作。'
      ].join('\n')
    }]);

    expect(timeline.totalEvents).toBe(1);
    expect(timeline.years[0].events[0].detail).toContain('赔偿金');
    expect(timeline.years[0].events[0].detail).not.toContain('SpaceX');
  });

  it('does not move two-digit dates from a previous year into the current article year', () => {
    const timeline = createAnnualTimeline([{
      id: 'a-2025',
      title: '这一年--我的2025',
      slug: 'year-2025',
      excerpt: '2025 复盘',
      status: 'published',
      content: [
        '24年12月8日，人生第一次参加省考。',
        '12月9日开始面试。'
      ].join('\n')
    }]);

    expect(timeline.totalEvents).toBe(1);
    expect(timeline.years[0].events[0]).toMatchObject({
      date: '2025-12-09',
      title: '开始面试'
    });
  });

  it('marks major personal milestones as featured events', () => {
    const timeline = createAnnualTimeline([{
      id: 'a-2025',
      title: '这一年--我的2025',
      slug: 'year-2025',
      excerpt: '2025 复盘',
      status: 'published',
      content: [
        '4月14日，科三第二次考试。',
        '4月，熊哥研究生补录成功，即将成为一名正儿八经的研究生。',
        '12月6日，萌萌来到威海，开着我的车，带着我人和行李，来到了济南，开启了下一段人生旅程。'
      ].join('\n')
    }]);

    expect(timeline.years[0].events.map((event) => ({
      date: event.date,
      featured: event.featured
    }))).toEqual([
      { date: '2025-12-06', featured: true },
      { date: '2025-04-14', featured: false },
      { date: '2025-04-01', featured: true }
    ]);
  });

  it('renders a public timeline section with animated event details', () => {
    expect(mainSource).toContain("path === '/timeline'");
    expect(mainSource).toContain('function YearTimelineExperience');
    expect(mainSource).toContain("api('/public/timeline')");
    expect(mainSource).toContain('timeline-event-detail');
    expect(mainSource).toContain("event.featured ? 'featured' : ''");
    expect(mainSource).toContain('重点');
    expect(mainSource).toContain('function DeepSeekAnnualInsight');
    expect(mainSource).toContain('timeline-insight-panel');
    expect(styles).toContain('.timeline-band');
    expect(styles).toContain('.timeline-constellation');
    expect(styles).toContain('.timeline-insight-panel');
    expect(styles).toContain('@keyframes timeline-scan');
  });
});
