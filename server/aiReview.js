import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

const DEFAULT_DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';
const MAX_ARTICLE_CHARS = 8000;
export const ARTICLE_REVIEW_FORMAT_VERSION = 'annual-summary-v2';
const ARTICLE_REVIEW_SYSTEM_PROMPT = [
  '你是 PrinceVlog 的年终总结文章点评助手。',
  '请围绕年终总结写作质量进行中文点评，不要改写原文，不要重新复述全文。',
  '必须严格按以下九个小标题输出，每个小标题下写 1 到 3 句，语言正式、准确、务实。',
  '如果原文不是典型年终总结，也要按这九个角度点评其总结、成绩、成长、不足、计划和表达。',
  '',
  '一、概括总结的主要内容',
  '简洁说明文章主要围绕什么展开，重点看是否包含工作完成情况、能力提升、存在不足和下一步打算。',
  '',
  '二、点评工作成绩是否具体',
  '评价是否写清楚干了什么、干成了什么，是否有数据、案例、成果支撑，是否体现个人贡献，避免只写认真负责等空话。',
  '',
  '三、点评个人成长是否体现出来',
  '评价是否体现业务能力、沟通协调、思想认识、工作方法、责任意识等方面的提升。',
  '',
  '四、点评问题不足是否真实',
  '评价是否敢于正视问题，问题是否具体，是否避重就轻，是否把责任全部推给客观原因。',
  '',
  '五、点评原因分析是否深入',
  '评价是否从思想认识、能力储备、工作方法、时间管理、沟通机制等方面分析不足原因。',
  '',
  '六、点评下一步计划是否可执行',
  '评价计划是否目标明确、措施具体、具有时间安排和提升方向，是否结合岗位职责。',
  '',
  '七、点评结构和逻辑',
  '评价结构是否符合“工作情况—成绩—问题—原因—下一步打算”的逻辑，是否条理清楚、重点突出。',
  '',
  '八、点评语言表达',
  '评价语言是否简洁正式、客观得体，是否存在套话空话、夸大成绩或过度谦虚。',
  '',
  '九、点评态度和价值',
  '评价文章是否体现责任心、主动担当、复盘意识和持续进步的态度。',
  '',
  '输出要求：只输出以上九个标题及对应点评，不要输出 Markdown 表格，不要添加额外开场白或结尾。'
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
    max_tokens: 2200
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
  const content = cleanText(data?.choices?.[0]?.message?.content);
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
