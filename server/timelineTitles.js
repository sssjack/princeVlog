import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { createAnnualTimeline } from './timeline.js';

const DEFAULT_DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_DEEPSEEK_TITLE_MODEL = 'deepseek-chat';
const TITLE_BATCH_SIZE = 6;
export const TIMELINE_TITLE_FORMAT_VERSION = 'timeline-title-v2';

const TITLE_SYSTEM_PROMPT = [
  '你是 PrinceVlog 的时间轴编辑。',
  '请把每个时间轴节点改写成符合正常人语义的中文完整短标题。',
  '要求：18 到 32 个汉字左右；必须是一句完整的话或一个完整小标题；不要硬截断；不要以逗号、顿号、冒号结尾；不要使用省略号；不要编造原文没有的信息。',
  '可以保留人名、考试、工作、情绪、地点等关键信息，让读者一眼知道这一节点发生了什么。',
  '只输出 JSON，不要 Markdown，不要代码块。',
  'JSON 顶层字段必须是 titles，值为数组；数组中每一项必须包含原始事件 id 和改写后的 title。'
].join('\n');

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function clipForPrompt(value, limit = 240) {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function annualTitleEvents(articles = []) {
  return createAnnualTimeline(articles)
    .years
    .flatMap((group) => group.events.map((event) => ({
      id: event.id,
      year: group.year,
      dateLabel: event.dateLabel,
      rawTitle: event.title,
      detail: event.detail,
      articleTitle: event.articleTitle
    })));
}

function sourceForEvents(events = []) {
  return events.map((event, index) => [
    `#${index + 1}`,
    `id: ${event.id}`,
    `year: ${event.year}`,
    `date: ${event.dateLabel}`,
    `article: ${event.articleTitle}`,
    `rawTitle: ${clipForPrompt(event.rawTitle, 140)}`,
    `detail: ${clipForPrompt(event.detail, 240)}`
  ].join('\n')).join('\n\n');
}

export function getTimelineTitleSourceHash(articles = []) {
  return crypto
    .createHash('sha256')
    .update(sourceForEvents(annualTitleEvents(articles)), 'utf8')
    .digest('hex');
}

function normalizeTitleMap(value = {}) {
  const titles = {};
  const source = value && typeof value === 'object' ? value : {};
  for (const [id, title] of Object.entries(source)) {
    const cleanId = cleanText(id);
    const cleanTitle = cleanText(title)
      .replace(/[，、,:：；;]+$/g, '')
      .replace(/\.{3,}|…+$/g, '')
      .trim();
    if (cleanId && cleanTitle) titles[cleanId] = cleanTitle;
  }
  return titles;
}

function fallbackTitleForEvent(event) {
  const text = cleanText(event.rawTitle || event.detail || `${event.dateLabel} 的记录`);
  const withoutLead = text
    .replace(/^(与此同时|然后|后来|下半句|上半句|到了|这时)[，,、\s]*/, '')
    .replace(/[，,。：:；;\s-]+$/g, '')
    .trim();
  const sentence = cleanText(withoutLead.split(/[。！？!?；;]/)[0], withoutLead);
  const clauses = sentence.split(/[，,、]/).map((item) => item.trim()).filter(Boolean);
  let title = '';
  for (const clause of clauses) {
    const candidate = title ? `${title}，${clause}` : clause;
    if (candidate.length > 34 && title) break;
    title = candidate;
  }
  return cleanText(title || sentence || text, `${event.dateLabel} 的记录`);
}

function parseJsonContent(content) {
  const text = cleanText(content);
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('DeepSeek returned invalid timeline title JSON');
    return JSON.parse(match[0]);
  }
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
        'Content-Type': 'application/json; charset=utf-8',
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
      request.destroy(new Error('DeepSeek timeline title request timed out'));
    });
    request.write(body);
    request.end();
  });
}

async function requestTitleBatch(events, { apiUrl, apiKey, model, fetchImpl }) {
  const payload = {
    model,
    messages: [
      { role: 'system', content: TITLE_SYSTEM_PROMPT },
      { role: 'user', content: sourceForEvents(events) }
    ],
    temperature: 0.25,
    max_tokens: 6000,
    response_format: { type: 'json_object' }
  };
  const headers = { Authorization: `Bearer ${apiKey}` };
  const response = typeof fetchImpl === 'function'
    ? await fetchImpl(apiUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    })
    : await postJsonWithNodeHttp(apiUrl, payload, headers);

  if (!response.ok) {
    throw new Error(`DeepSeek timeline title request failed with status ${response.status}`);
  }

  const data = await response.json();
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('DeepSeek timeline title response was truncated by max_tokens');
  }
  const parsed = parseJsonContent(choice?.message?.content);
  const titles = {};
  for (const item of Array.isArray(parsed.titles) ? parsed.titles : []) {
    const cleanId = cleanText(item?.id);
    const cleanTitle = cleanText(item?.title);
    if (cleanId && cleanTitle) titles[cleanId] = cleanTitle;
  }
  return normalizeTitleMap(titles);
}

async function requestTitleBatchWithRetry(events, context) {
  try {
    return await requestTitleBatch(events, context);
  } catch (error) {
    const truncated = /truncated|max_tokens/i.test(error?.message || '');
    if (!truncated) throw error;
    if (events.length <= 1) {
      const event = events[0];
      return event ? { [event.id]: fallbackTitleForEvent(event) } : {};
    }

    const middle = Math.ceil(events.length / 2);
    const left = await requestTitleBatchWithRetry(events.slice(0, middle), context);
    const right = await requestTitleBatchWithRetry(events.slice(middle), context);
    return { ...left, ...right };
  }
}

export function needsTimelineEventTitles(articles = [], timelineTitles = {}) {
  const sourceHash = getTimelineTitleSourceHash(articles);
  return !timelineTitles
    || timelineTitles.status !== 'ready'
    || timelineTitles.formatVersion !== TIMELINE_TITLE_FORMAT_VERSION
    || timelineTitles.sourceHash !== sourceHash
    || Object.keys(timelineTitles.titles || {}).length === 0;
}

export async function generateTimelineEventTitles(articles = [], {
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const apiKey = cleanText(env.DEEPSEEK_API_KEY);
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const events = annualTitleEvents(articles);
  const apiUrl = cleanText(env.DEEPSEEK_API_URL, DEFAULT_DEEPSEEK_API_URL);
  const model = cleanText(env.DEEPSEEK_TITLE_MODEL, DEFAULT_DEEPSEEK_TITLE_MODEL);
  const generated = {};

  for (const batch of chunk(events, TITLE_BATCH_SIZE)) {
    Object.assign(generated, await requestTitleBatchWithRetry(batch, {
      apiUrl,
      apiKey,
      model,
      fetchImpl
    }));
  }

  const titles = {};
  for (const event of events) {
    titles[event.id] = generated[event.id] || event.rawTitle;
  }

  return {
    status: 'ready',
    titles: normalizeTitleMap(titles),
    sourceHash: getTimelineTitleSourceHash(articles),
    model,
    formatVersion: TIMELINE_TITLE_FORMAT_VERSION,
    error: '',
    updatedAt: new Date().toISOString()
  };
}

export function createTimelineTitleQueue({
  store,
  generateTitles = generateTimelineEventTitles,
  logger = console
} = {}) {
  let active = false;

  async function refreshTitles() {
    if (!store || active || !cleanText(process.env.DEEPSEEK_API_KEY)) return false;
    active = true;
    try {
      const articles = await store.listArticles({ includeDrafts: true });
      const titleState = await store.getTimelineEventTitles();
      if (!needsTimelineEventTitles(articles, titleState)) return false;
      await store.setTimelineEventTitles({
        status: 'pending',
        error: '',
        sourceHash: getTimelineTitleSourceHash(articles)
      });
      const result = await generateTitles(articles);
      await store.setTimelineEventTitles(result);
      return true;
    } catch (error) {
      try {
        await store.setTimelineEventTitles({
          status: 'failed',
          error: error.message || 'DeepSeek timeline title failed'
        });
      } catch {
        // Keep the original failure visible in logs.
      }
      logger?.error?.('timeline title generation failed', error.message || error);
      return false;
    } finally {
      active = false;
    }
  }

  function enqueueTitles() {
    if (!store || active || !cleanText(process.env.DEEPSEEK_API_KEY)) return false;
    setTimeout(() => {
      refreshTitles().catch((error) => {
        logger?.error?.('timeline title queue failed', error.message || error);
      });
    }, 0);
    return true;
  }

  return {
    enqueueTitles,
    refreshTitles
  };
}
