import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

const DEFAULT_DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';
const MAX_ARTICLE_CHARS = 8000;
const ARTICLE_REVIEW_MAX_TOKENS = 6000;
export const ARTICLE_REVIEW_FORMAT_VERSION = 'comprehensive-500-v4';
const ARTICLE_REVIEW_SYSTEM_PROMPT = [
  '你是 PrinceVlog 的文章点评助手。',
  '请根据用户提供的文章生成一篇中文全面点评，要求不少于500字。',
  '点评要自然连贯，可以分成少量自然段，但不要使用固定九项小标题，不要写成表格，也不要显得像模板填空。',
  '不要改写原文，不要重新复述全文；先简洁概括文章主要内容，再结合文章实际展开评价。',
  '',
  '点评内容可以覆盖这些方面，但要根据文章情况灵活组织，不要机械逐条罗列：',
  '1. 文章主要写了什么，中心是否清楚。',
  '2. 工作成绩或经历成果是否具体，是否有数据、案例、成果或个人贡献支撑。',
  '3. 是否体现作者的个人成长、能力提升、责任意识、沟通协作或工作方法变化。',
  '4. 对问题和不足的分析是否真实具体，是否避重就轻，是否把责任完全推给客观原因。',
  '5. 不足背后的原因分析是否深入，是否能从思想认识、能力储备、工作方法、时间管理、沟通机制等方面反思。',
  '6. 下一步计划是否明确、可执行，是否写清提升方式、时间安排、目标效果，并与岗位或主题结合。',
  '7. 文章结构和逻辑是否清晰，重点是否突出，是否像流水账。',
  '8. 语言表达是否正式、准确、务实，是否存在套话空话、夸大成绩或过度谦虚。',
  '9. 整体态度和价值是否体现责任心、主动担当、复盘意识和持续进步。',
  '',
  '输出要求：只输出点评正文，语言要具体、温和、务实，有肯定也有改进建议；全文不少于500字。'
].join('\n');

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
    || review.formatVersion !== ARTICLE_REVIEW_FORMAT_VERSION
    || review.sourceHash !== getArticleReviewSourceHash(article);
}

function postJsonWithNodeHttp(url, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const target = new URL(url);
    const transport = target.protocol === 'http:' ? http : https;
    const request = transport.request({
      method: 'POST',
      hostname: target.hostname,
      port: target.port || undefined,
      path: `${target.pathname}${target.search}`,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          json: async () => (raw ? JSON.parse(raw) : {})
        });
      });
    });

    request.on('error', reject);
    request.setTimeout(60_000, () => {
      request.destroy(new Error('DeepSeek request timed out'));
    });
    request.write(body);
    request.end();
  });
}

export async function generateArticleReview(article, {
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const apiKey = cleanText(env.DEEPSEEK_API_KEY);
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const apiUrl = cleanText(env.DEEPSEEK_API_URL, DEFAULT_DEEPSEEK_API_URL);
  const model = cleanText(env.DEEPSEEK_MODEL, DEFAULT_DEEPSEEK_MODEL);
  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: ARTICLE_REVIEW_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: getArticleReviewSource(article)
      }
    ],
    temperature: 0.55,
    max_tokens: ARTICLE_REVIEW_MAX_TOKENS
  };

  const headers = { Authorization: `Bearer ${apiKey}` };
  const response = typeof fetchImpl === 'function'
    ? await fetchImpl(apiUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    : await postJsonWithNodeHttp(apiUrl, payload, headers);

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with status ${response.status}`);
  }

  const data = await response.json();
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('DeepSeek response was truncated by max_tokens');
  }
  const content = cleanText(choice?.message?.content);
  if (!content) {
    throw new Error('DeepSeek returned an empty review');
  }

  return {
    status: 'ready',
    content,
    sourceHash: getArticleReviewSourceHash(article),
    model,
    formatVersion: ARTICLE_REVIEW_FORMAT_VERSION,
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
