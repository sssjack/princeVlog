import { describe, expect, it, vi } from 'vitest';
import {
  TIMELINE_TITLE_FORMAT_VERSION,
  generateTimelineEventTitles,
  getTimelineTitleSourceHash,
  needsTimelineEventTitles
} from '../server/timelineTitles.js';

const annualArticles = [
  {
    id: 'a-2025',
    title: '这一年--我的2025',
    slug: 'year-2025',
    excerpt: '2025 复盘',
    status: 'published',
    content: [
      '4月，与此同时，熊哥继大半年没上班后默默参加了研究生考试，并且笔试过了国家线1分成功进入复试。',
      '1月，整个人依旧笼罩在各种恐慌操作的阴霾底下，只想快速考完驾照然后找工作。'
    ].join('\n')
  }
];

describe('timeline event AI titles', () => {
  it('detects when cached timeline event titles need regeneration', () => {
    const sourceHash = getTimelineTitleSourceHash(annualArticles);

    expect(needsTimelineEventTitles(annualArticles, null)).toBe(true);
    expect(needsTimelineEventTitles(annualArticles, {
      status: 'ready',
      sourceHash,
      formatVersion: TIMELINE_TITLE_FORMAT_VERSION,
      titles: {
        'year-2025-2025-04-01-1': '熊哥考研过线进入复试'
      }
    })).toBe(false);
    expect(needsTimelineEventTitles(annualArticles, {
      status: 'ready',
      sourceHash: 'old-hash',
      formatVersion: TIMELINE_TITLE_FORMAT_VERSION,
      titles: {}
    })).toBe(true);
    expect(needsTimelineEventTitles(annualArticles, {
      status: 'ready',
      sourceHash,
      formatVersion: 'timeline-title-v1',
      titles: {
        'year-2025-2025-04-01-1': '熊哥考研过线进入复试'
      }
    })).toBe(true);
  });

  it('asks DeepSeek to rewrite every event title as a complete semantic title', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              titles: [
                { id: 'year-2025-2025-04-01-1', title: '熊哥考研过线进入复试' },
                { id: 'year-2025-2025-01-01-2', title: '在焦虑中准备驾照和找工作' }
              ]
            })
          }
        }]
      })
    });

    const result = await generateTimelineEventTitles(annualArticles, {
      env: {
        DEEPSEEK_API_URL: 'https://deepseek.example/chat/completions',
        DEEPSEEK_API_KEY: 'test-key',
        DEEPSEEK_MODEL: 'deepseek-v4-pro',
        DEEPSEEK_TITLE_MODEL: 'deepseek-chat'
      },
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://deepseek.example/chat/completions');
    expect(request.headers.Authorization).toBe('Bearer test-key');
    expect(request.headers['Content-Type']).toBe('application/json; charset=utf-8');
    const payload = JSON.parse(request.body);
    expect(payload.model).toBe('deepseek-chat');
    expect(payload.messages[0].content).toContain('完整短标题');
    expect(payload.messages[1].content).toContain('国家线1分成功进入复试');
    expect(result).toMatchObject({
      status: 'ready',
      model: 'deepseek-chat',
      formatVersion: TIMELINE_TITLE_FORMAT_VERSION,
      titles: {
        'year-2025-2025-04-01-1': '熊哥考研过线进入复试',
        'year-2025-2025-01-01-2': '在焦虑中准备驾照和找工作'
      }
    });
    expect(result.sourceHash).toBe(getTimelineTitleSourceHash(annualArticles));
  });

  it('uses small title batches so DeepSeek responses are not forced to truncate', async () => {
    const manyEventsArticle = [{
      id: 'a-2025',
      title: '这一年--我的2025',
      slug: 'year-2025',
      excerpt: '2025 复盘',
      status: 'published',
      content: Array.from({ length: 7 }, (_item, index) => (
        `${index + 1}月，完成了第${index + 1}个重要节点，继续向前推进。`
      )).join('\n')
    }];
    const fetchImpl = vi.fn(async (_url, request) => {
      const payload = JSON.parse(request.body);
      const ids = [...payload.messages[1].content.matchAll(/id: (.+)/g)].map((match) => match[1].trim());
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                titles: ids.map((id, index) => ({ id, title: `第${index + 1}个节点完成` }))
              })
            }
          }]
        })
      };
    });

    await generateTimelineEventTitles(manyEventsArticle, {
      env: {
        DEEPSEEK_API_URL: 'https://deepseek.example/chat/completions',
        DEEPSEEK_API_KEY: 'test-key',
        DEEPSEEK_MODEL: 'deepseek-v4-pro'
      },
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).model).toBe('deepseek-chat');
  });
});
