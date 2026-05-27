import { describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import {
  generateArticleReview,
  getArticleReviewSourceHash,
  isAiReviewConfigured,
  needsArticleAiReview
} from '../server/aiReview.js';

const article = {
  id: 'article-1',
  title: '城市傍晚的风',
  subtitle: '走过河边以后的一点记录',
  excerpt: '一次很安静的散步',
  content: '# 傍晚\n\n今天沿着河边走了很久，看见风把灯光吹散。'
};

describe('article AI review', () => {
  it('calls the configured DeepSeek chat completion endpoint and returns review metadata', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '这篇文章有很好的现场感，适合继续补充一个更具体的结尾。' } }]
      })
    });

    const result = await generateArticleReview(article, {
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
    expect(request.body).not.toContain('test-key');
    const payload = JSON.parse(request.body);
    expect(payload.model).toBe('deepseek-v4-pro');
    expect(payload.messages[1].content).toContain(article.title);
    expect(payload.messages[1].content).toContain(article.content);
    expect(result).toMatchObject({
      status: 'ready',
      content: '这篇文章有很好的现场感，适合继续补充一个更具体的结尾。',
      model: 'deepseek-v4-pro'
    });
    expect(result.sourceHash).toBe(getArticleReviewSourceHash(article));
  });

  it('detects whether an article needs a fresh AI review', () => {
    const sourceHash = getArticleReviewSourceHash(article);

    expect(isAiReviewConfigured({ DEEPSEEK_API_KEY: 'test-key' })).toBe(true);
    expect(isAiReviewConfigured({ DEEPSEEK_API_KEY: '' })).toBe(false);
    expect(needsArticleAiReview({ ...article, status: 'draft' })).toBe(false);
    expect(needsArticleAiReview({ ...article, status: 'published' })).toBe(true);
    expect(needsArticleAiReview({
      ...article,
      status: 'published',
      aiReview: { status: 'ready', content: 'ok', sourceHash }
    })).toBe(false);
    expect(needsArticleAiReview({
      ...article,
      status: 'published',
      content: `${article.content}\n\n补充一句。`,
      aiReview: { status: 'ready', content: 'ok', sourceHash }
    })).toBe(true);
  });

  it('can call DeepSeek through the Node HTTP fallback when fetch is unavailable', async () => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        expect(req.method).toBe('POST');
        expect(req.headers.authorization).toBe('Bearer test-key');
        expect(JSON.parse(body).model).toBe('deepseek-v4-pro');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          choices: [{ message: { content: 'HTTP fallback 点评内容' } }]
        }));
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    try {
      const result = await generateArticleReview(article, {
        env: {
          DEEPSEEK_API_URL: `http://127.0.0.1:${port}/chat/completions`,
          DEEPSEEK_API_KEY: 'test-key',
          DEEPSEEK_MODEL: 'deepseek-v4-pro'
        },
        fetchImpl: null
      });

      expect(result.content).toBe('HTTP fallback 点评内容');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
