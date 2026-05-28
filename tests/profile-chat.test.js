import { describe, expect, it, vi } from 'vitest';
import {
  PROFILE_CHAT_FORMAT_VERSION,
  UNKNOWN_PROFILE_ANSWER,
  answerProfileQuestion,
  buildProfileKnowledgeIndex,
  findRelevantProfileKnowledge
} from '../server/profileChat.js';

const articles = [
  {
    id: 'year-2025',
    title: '这一年--我的2025',
    subtitle: '复试和重新出发',
    slug: 'year-2025',
    excerpt: '这一年有考试、焦虑，也有继续往前走。',
    content: [
      '4月，熊哥参加了研究生考试，笔试过了国家线1分，成功进入复试。',
      '复试前，他开始认真整理资料，也慢慢把注意力从焦虑里拽回来。',
      '这件事对他很重要，因为它代表着重新建立秩序和信心。'
    ].join('\n'),
    status: 'published',
    updatedAt: '2025-04-20T00:00:00.000Z'
  },
  {
    id: 'draft-1',
    title: '还不能公开的草稿',
    slug: 'draft-secret',
    excerpt: '草稿内容',
    content: '这个内容不应该进入公开知识库。',
    status: 'draft',
    updatedAt: '2025-04-21T00:00:00.000Z'
  },
  {
    id: 'year-2024',
    title: '这一年--我的2024',
    subtitle: '为下一年做准备',
    slug: 'year-2024',
    excerpt: '提到了2025年的计划。',
    content: '12月，他计划在2025年继续准备考试，也想把状态慢慢找回来。',
    status: 'published',
    updatedAt: '2024-12-31T00:00:00.000Z'
  }
];

describe('profile AI chat knowledge base', () => {
  it('builds a public article knowledge index and excludes drafts', () => {
    const index = buildProfileKnowledgeIndex(articles, { chunkSize: 70, overlap: 12 });

    expect(index.formatVersion).toBe(PROFILE_CHAT_FORMAT_VERSION);
    expect(index.sourceHash).toHaveLength(64);
    expect(index.chunks.some((chunk) => chunk.articleTitle === '这一年--我的2025')).toBe(true);
    expect(index.chunks.some((chunk) => chunk.text.includes('研究生考试'))).toBe(true);
    expect(index.chunks.some((chunk) => chunk.articleTitle === '还不能公开的草稿')).toBe(false);
  });

  it('finds relevant personal knowledge for Chinese questions', () => {
    const index = buildProfileKnowledgeIndex(articles, { chunkSize: 90, overlap: 16 });

    const hits = findRelevantProfileKnowledge(index, '他考研怎么样，复试有进展吗？', { limit: 3 });

    expect(hits[0]).toMatchObject({
      articleTitle: '这一年--我的2025',
      articleSlug: 'year-2025'
    });
    expect(hits[0].text).toContain('国家线1分');
  });

  it('uses annual self-summary context for broad change questions', () => {
    const index = buildProfileKnowledgeIndex([
      {
        id: 'year-2025-growth',
        title: '这一年--我的2025',
        subtitle: '复试和重新出发',
        slug: 'year-2025-growth',
        excerpt: '这一年有考试、焦虑，也有继续往前走。',
        content: [
          '4月，熊哥参加了研究生考试，笔试过了国家线1分，成功进入复试。',
          '后来他从焦虑等待，到主动复盘，重新建立秩序和信心，也愿意继续向前。'
        ].join('\n'),
        status: 'published',
        updatedAt: '2025-04-20T00:00:00.000Z'
      }
    ], { chunkSize: 90, overlap: 16 });

    const hits = findRelevantProfileKnowledge(index, '最大的变化是什么？', { limit: 3 });

    expect(hits[0]).toMatchObject({
      articleTitle: '这一年--我的2025',
      articleSlug: 'year-2025-growth'
    });
    expect(hits[0].text).toContain('主动复盘');
  });

  it('asks AI to offer article-grounded opinions for weakness questions', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '根据文章归纳，Prince 的短板可能是容易被焦虑牵着走，状态不稳时需要重新建立秩序。'
          }
        }]
      })
    });

    const result = await answerProfileQuestion('他的缺点是什么？', articles, {
      env: {
        DEEPSEEK_API_URL: 'https://deepseek.example/chat/completions',
        DEEPSEEK_API_KEY: 'test-key',
        DEEPSEEK_MODEL: 'deepseek-v4-pro'
      },
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, request] = fetchImpl.mock.calls[0];
    const payload = JSON.parse(request.body);
    expect(payload.messages[0].content).toContain('可以给出你的看法');
    expect(payload.messages[1].content).toContain('焦虑');
    expect(result.answer).toContain('焦虑');
    expect(result.sources[0]).toMatchObject({
      title: '这一年--我的2025',
      slug: 'year-2025'
    });
  });

  it('prioritizes the matching annual article when the question names a year', () => {
    const index = buildProfileKnowledgeIndex([
      {
        id: 'year-2024-plan',
        title: '这一年--我的2024',
        slug: 'year-2024-plan',
        content: '12月，他计划2025年考研，并继续准备复试。',
        status: 'published',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'year-2025-exam',
        title: '这一年--我的2025',
        slug: 'year-2025-exam',
        content: '4月，熊哥参加研究生考试，笔试过了国家线1分，成功进入复试。',
        status: 'published',
        updatedAt: '2025-01-01T00:00:00.000Z'
      }
    ], { chunkSize: 90, overlap: 16 });

    const hits = findRelevantProfileKnowledge(index, '他2025年考研怎么样？', { limit: 3 });

    expect(hits[0].articleTitle).toBe('这一年--我的2025');
  });

  it('answers with an unknown fallback without calling AI when no knowledge exists', async () => {
    const fetchImpl = vi.fn();

    const result = await answerProfileQuestion('他最喜欢哪座城市？', [], {
      env: {
        DEEPSEEK_API_KEY: 'test-key'
      },
      fetchImpl
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.answer).toBe(UNKNOWN_PROFILE_ANSWER);
    expect(result.sources).toEqual([]);
  });

  it('asks DeepSeek to answer only from matched article snippets', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '根据文章，Prince 在2025年参加研究生考试并进入复试，这件事代表他在焦虑中重新建立秩序。'
          }
        }]
      })
    });

    const result = await answerProfileQuestion('他2025年考研怎么样？', articles, {
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
    expect(payload.messages[0].content).toContain('只能根据');
    expect(payload.messages[0].content).toContain('建议你直接问他本人');
    expect(payload.messages[1].content).toContain('参考知识片段');
    expect(payload.messages[1].content).toContain('这一年--我的2025');
    expect(payload.messages[1].content).toContain('国家线1分');
    expect(result.answer).toContain('研究生考试');
    expect(result.sources[0]).toMatchObject({
      title: '这一年--我的2025',
      slug: 'year-2025'
    });
  });

  it('normalizes model fallback answers to the exact unknown response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: `${UNKNOWN_PROFILE_ANSWER} 文章里只提到了别的考试。`
          }
        }]
      })
    });

    const result = await answerProfileQuestion('他2025年最喜欢哪座城市？', articles, {
      env: {
        DEEPSEEK_API_URL: 'https://deepseek.example/chat/completions',
        DEEPSEEK_API_KEY: 'test-key',
        DEEPSEEK_MODEL: 'deepseek-v4-pro'
      },
      fetchImpl
    });

    expect(result.answer).toBe(UNKNOWN_PROFILE_ANSWER);
    expect(result.sources).toEqual([]);
  });
});
