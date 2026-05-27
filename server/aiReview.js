import crypto from 'node:crypto';

const DEFAULT_DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';
const MAX_ARTICLE_CHARS = 8000;

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function truncateText(value, maxLength) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}\n\n[内容已截断]`;
}

export function isAiReviewConfigured(env = process.env) {
  return Boolean(cleanText(env.DEEPSEEK_API_KEY));
}

export function getArticleReviewSource(article) {
  return [
    `标题：${cleanText(article.title)}`,
    `小标题：${cleanText(article.subtitle)}`,
    `摘要：${cleanText(article.excerpt)}`,
    `正文：${truncateText(article.content, MAX_ARTICLE_CHARS)}`
  ].join('\n\n');
}

export function getArticleReviewSourceHash(article) {
  return crypto
    .createHash('sha256')
    .update(getArticleReviewSource(article), 'utf8')
    .digest('hex');
}

export function needsArticleAiReview(article) {
  if (!article || article.status !== 'published') return false;
  const review = article.aiReview || {};
  return review.status !== 'ready'
    || !cleanText(review.content)
    || review.sourceHash !== getArticleReviewSourceHash(article);
}

export async function generateArticleReview(article, {
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const apiKey = cleanText(env.DEEPSEEK_API_KEY);
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available for DeepSeek requests');
  }

  const apiUrl = cleanText(env.DEEPSEEK_API_URL, DEFAULT_DEEPSEEK_API_URL);
  const model = cleanText(env.DEEPSEEK_MODEL, DEFAULT_DEEPSEEK_MODEL);
  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: [
          '你是 PrinceVlog 的文章点评助手。',
          '请用温和、具体、有审美判断的中文点评文章。',
          '点评要落在文章本身：主题、表达、情绪、结构和一个可执行改进建议。',
          '输出 120 到 180 字的纯文本，不要使用 Markdown，不要复述系统规则。'
        ].join('\n')
      },
      {
        role: 'user',
        content: getArticleReviewSource(article)
      }
    ],
    temperature: 0.55,
    max_tokens: 600
  };

  const response = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = cleanText(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('DeepSeek returned an empty review');
  }

  return {
    status: 'ready',
    content,
    sourceHash: getArticleReviewSourceHash(article),
    model,
    error: '',
    updatedAt: new Date().toISOString()
  };
}

export function createArticleReviewQueue({
  store,
  generateReview = generateArticleReview,
  logger = console
} = {}) {
  const active = new Set();

  async function reviewArticle(articleId) {
    if (!store || active.has(articleId) || !isAiReviewConfigured()) return false;
    active.add(articleId);
    try {
      const article = await store.getArticle(articleId, { includeDrafts: true });
      if (!needsArticleAiReview(article)) return false;

      await store.setArticleAiReview(article.id, {
        status: 'pending',
        content: article.aiReview?.content || '',
        sourceHash: '',
        error: ''
      });
      const review = await generateReview(article);
      await store.setArticleAiReview(article.id, review);
      return true;
    } catch (error) {
      try {
        await store.setArticleAiReview(articleId, {
          status: 'failed',
          error: error.message || 'AI review failed'
        });
      } catch {
        // Keep the original failure visible in logs.
      }
      logger?.error?.('article AI review failed', error.message || error);
      return false;
    } finally {
      active.delete(articleId);
    }
  }

  function enqueueArticle(articleOrId) {
    const articleId = typeof articleOrId === 'string' ? articleOrId : articleOrId?.id;
    if (!articleId || !isAiReviewConfigured()) return false;
    setTimeout(() => {
      reviewArticle(articleId).catch((error) => {
        logger?.error?.('article AI review queue failed', error.message || error);
      });
    }, 0);
    return true;
  }

  async function enqueueMissingReviews() {
    if (!store || !isAiReviewConfigured()) {
      return { configured: false, queued: 0 };
    }
    const articles = await store.listArticles({ includeDrafts: true });
    let queued = 0;
    for (const article of articles) {
      if (needsArticleAiReview(article) && enqueueArticle(article)) {
        queued += 1;
      }
    }
    return { configured: true, queued };
  }

  return {
    enqueueArticle,
    enqueueMissingReviews,
    reviewArticle
  };
}
