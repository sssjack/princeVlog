import { describe, expect, it, vi } from 'vitest';
import {
  ANNUAL_TIMELINE_INSIGHT_FORMAT_VERSION,
  generateAnnualTimelineInsight,
  getAnnualTimelineInsightSourceHash,
  needsAnnualTimelineInsight
} from '../server/timelineInsight.js';

const annualArticles = [
  {
    id: 'a-2024',
    title: '这一年--我的2024',
    slug: 'year-2024',
    excerpt: '2024 复盘',
    status: 'published',
    content: '1月1日，跨年夜。7月，开始认真处理人生的新问题。',
    aiReview: { content: '2024 年度点评' }
  },
  {
    id: 'a-2023',
    title: '这一年--我的2023',
    slug: 'year-2023',
    excerpt: '2023 复盘',
    status: 'published',
    content: '1月1日，广州游。2月11日，正式脱单。',
    aiReview: { content: '2023 年度点评' }
  }
];

describe('annual timeline insight', () => {
  it('detects whether DeepSeek insight needs to be regenerated', () => {
    const sourceHash = getAnnualTimelineInsightSourceHash(annualArticles);

    expect(needsAnnualTimelineInsight(annualArticles, null)).toBe(true);
    expect(needsAnnualTimelineInsight(annualArticles, {
      status: 'ready',
      sourceHash,
      formatVersion: ANNUAL_TIMELINE_INSIGHT_FORMAT_VERSION,
      overall: 'ok'
    })).toBe(false);
    expect(needsAnnualTimelineInsight(annualArticles, {
      status: 'ready',
      sourceHash: 'old-hash',
      formatVersion: ANNUAL_TIMELINE_INSIGHT_FORMAT_VERSION,
      overall: 'ok'
    })).toBe(true);
  });

  it('calls DeepSeek and normalizes the structured personal review', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              overall: '这些年终总结呈现出一条从试错到自我建构的长期路径。',
              personalEvaluation: '作者有强烈的自我观察能力，也愿意把现实压力写进复盘。',
              strengths: ['长期主义明显', '反思密度高'],
              weaknesses: ['有时计划过满', '情绪消耗偏大'],
              suggestions: ['把目标拆成季度节奏', '保留休息和关系经营的预算']
            })
          }
        }]
      })
    });

    const result = await generateAnnualTimelineInsight(annualArticles, {
      env: {
        DEEPSEEK_API_URL: 'https://deepseek.example/chat/completions',
        DEEPSEEK_API_KEY: 'test-key',
        DEEPSEEK_MODEL: 'deepseek-v4-pro'
      },
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://deepseek.example/chat/completions');
    expect(request.headers.Authorization).toBe('Bearer test-key');
    const payload = JSON.parse(request.body);
    expect(payload.messages[1].content).toContain('这一年--我的2024');
    expect(payload.messages[1].content).toContain('2024 年度点评');
    expect(result).toMatchObject({
      status: 'ready',
      model: 'deepseek-v4-pro',
      formatVersion: ANNUAL_TIMELINE_INSIGHT_FORMAT_VERSION,
      overall: '这些年终总结呈现出一条从试错到自我建构的长期路径。',
      personalEvaluation: '作者有强烈的自我观察能力，也愿意把现实压力写进复盘。',
      strengths: ['长期主义明显', '反思密度高'],
      weaknesses: ['有时计划过满', '情绪消耗偏大'],
      suggestions: ['把目标拆成季度节奏', '保留休息和关系经营的预算']
    });
    expect(result.sourceHash).toBe(getAnnualTimelineInsightSourceHash(annualArticles));
  });
});
