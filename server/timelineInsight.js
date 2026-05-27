import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { createAnnualTimeline } from './timeline.js';

const DEFAULT_DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';
const MAX_ARTICLE_CHARS = 7000;
export const ANNUAL_TIMELINE_INSIGHT_FORMAT_VERSION = 'annual-timeline-insight-v1';

const INSIGHT_SYSTEM_PROMPT = [
  '你是 PrinceVlog 的长期复盘评论者。',
  '请基于用户提供的多篇年终总结，输出一份中文结构化评价。',
  '评价要真实、温和、具体，不要奉承，不要空泛。',
  '必须覆盖：对这些年终总结的评价、对作者个人的评价、优点、缺点、建议。',
  '只输出 JSON，不要 Markdown，不要代码块。',
  'JSON 字段必须是：overall、personalEvaluation、strengths、weaknesses、suggestions。',
  'overall 和 personalEvaluation 是字符串；strengths、weaknesses、suggestions 都是 3 到 5 个字符串数组。'
].join('\n');

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function truncateText(value, maxLength) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}\n\n[内容已截断]`;
}

function annualArticles(articles = []) {
  return articles
    .filter((article) => article?.status !== 'draft' && /^这一年--.*?20\d{2}/.test(cleanText(article?.title)))
    .sort((a, b) => cleanText(b.title).localeCompare(cleanText(a.title), 'zh-Hans-CN'));
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 5);
}

function parseJsonContent(content) {
  const text = cleanText(content);
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('DeepSeek returned an invalid insight JSON');
    return JSON.parse(match[0]);
  }
}

export function getAnnualTimelineInsightSource(articles = []) {
  const selected = annualArticles(articles);
  const timeline = createAnnualTimeline(selected);
  return selected.map((article) => {
    const events = timeline.years
      .find((group) => group.article.id === article.id)
      ?.events
      ?.slice(0, 30)
      ?.map((event) => `${event.dateLabel}：${event.detail}`)
      ?.join('\n') || '';
    return [
      `标题：${cleanText(article.title)}`,
      `摘要：${cleanText(article.excerpt)}`,
      `时间节点：\n${events}`,
      `已有 AI 点评：${cleanText(article.aiReview?.content)}`,
      `正文节选：\n${truncateText(article.content, MAX_ARTICLE_CHARS)}`
    ].join('\n\n');
  }).join('\n\n---\n\n');
}

export function getAnnualTimelineInsightSourceHash(articles = []) {
  return crypto
    .createHash('sha256')
    .update(getAnnualTimelineInsightSource(articles), 'utf8')
    .digest('hex');
}

export function needsAnnualTimelineInsight(articles = [], insight = {}) {
  const sourceHash = getAnnualTimelineInsightSourceHash(articles);
  return !insight
    || insight.status !== 'ready'
    || !cleanText(insight.overall)
    || insight.formatVersion !== ANNUAL_TIMELINE_INSIGHT_FORMAT_VERSION
    || insight.sourceHash !== sourceHash;
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
    request.setTimeout(120_000, () => {
      request.destroy(new Error('DeepSeek timeline insight request timed out'));
    });
    request.write(body);
    request.end();
  });
}

export async function generateAnnualTimelineInsight(articles = [], {
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
      { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
      { role: 'user', content: getAnnualTimelineInsightSource(articles) }
    ],
    temperature: 0.45,
    max_tokens: 2600,
    response_format: { type: 'json_object' }
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
    throw new Error(`DeepSeek timeline insight request failed with status ${response.status}`);
  }

  const data = await response.json();
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('DeepSeek timeline insight response was truncated by max_tokens');
  }
  const parsed = parseJsonContent(choice?.message?.content);
  const result = {
    status: 'ready',
    overall: cleanText(parsed.overall),
    personalEvaluation: cleanText(parsed.personalEvaluation),
    strengths: normalizeList(parsed.strengths),
    weaknesses: normalizeList(parsed.weaknesses),
    suggestions: normalizeList(parsed.suggestions),
    sourceHash: getAnnualTimelineInsightSourceHash(articles),
    model,
    formatVersion: ANNUAL_TIMELINE_INSIGHT_FORMAT_VERSION,
    error: '',
    updatedAt: new Date().toISOString()
  };

  if (!result.overall || !result.personalEvaluation) {
    throw new Error('DeepSeek returned an incomplete timeline insight');
  }
  return result;
}

export function createAnnualTimelineInsightQueue({
  store,
  generateInsight = generateAnnualTimelineInsight,
  logger = console
} = {}) {
  let active = false;

  async function refreshInsight() {
    if (!store || active || !cleanText(process.env.DEEPSEEK_API_KEY)) return false;
    active = true;
    try {
      const articles = await store.listArticles({ includeDrafts: true });
      const insight = await store.getAnnualTimelineInsight();
      if (!needsAnnualTimelineInsight(articles, insight)) return false;
      await store.setAnnualTimelineInsight({
        status: 'pending',
        error: '',
        sourceHash: getAnnualTimelineInsightSourceHash(articles)
      });
      const result = await generateInsight(articles);
      await store.setAnnualTimelineInsight(result);
      return true;
    } catch (error) {
      try {
        await store.setAnnualTimelineInsight({
          status: 'failed',
          error: error.message || 'DeepSeek timeline insight failed'
        });
      } catch {
        // Keep the original failure visible in logs.
      }
      logger?.error?.('annual timeline insight failed', error.message || error);
      return false;
    } finally {
      active = false;
    }
  }

  function enqueueInsight() {
    if (!store || active || !cleanText(process.env.DEEPSEEK_API_KEY)) return false;
    setTimeout(() => {
      refreshInsight().catch((error) => {
        logger?.error?.('annual timeline insight queue failed', error.message || error);
      });
    }, 0);
    return true;
  }

  return {
    enqueueInsight,
    refreshInsight
  };
}
