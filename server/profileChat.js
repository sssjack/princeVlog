import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

const DEFAULT_DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';
const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_CHUNK_OVERLAP = 140;
const PROFILE_CHAT_MAX_TOKENS = 1200;

export const PROFILE_CHAT_FORMAT_VERSION = 'profile-chat-v1';
export const UNKNOWN_PROFILE_ANSWER = '这个问题我从 Prince 的文章里没有找到可靠信息，建议你直接问他本人。';

const PROFILE_CHAT_SYSTEM_PROMPT = [
  '你是 PrinceVlog 的公开自我介绍问答助手。',
  '你只能根据用户提供的“参考知识片段”回答关于 Prince 的问题。',
  '如果参考片段没有明确依据，不要猜测，不要编造，不要用常识补全。',
  `没有依据时，回答：“${UNKNOWN_PROFILE_ANSWER}”`,
  '回答要自然、阳光、可爱一点，但必须忠实于文章事实。',
  '用户问优点、缺点、性格、建议等评价型问题时，可以给出你的看法，但必须基于参考片段做温和归纳，并说明这是从文章里归纳出的判断。',
  '先直接回答用户的具体问题，不要把整篇文章或整年经历都总结一遍。',
  '可以简短引用文章中的事实，但不要大段复述原文。',
  '如果答案有依据，结尾用一行列出“参考文章：文章名”。'
].join('\n');

const STOP_CHARS = new Set('的一是在了和也有就都而及与或但被把让给到从这那他她它你我吗呢吧啊呀哦很更最中上下来过着里外个些之其于');
const BROAD_PROFILE_QUESTION_PATTERNS = [
  /这几年/u,
  /这些年/u,
  /几年/u,
  /最大/u,
  /变化/u,
  /改变/u,
  /成长/u,
  /转折/u,
  /经历/u,
  /重大/u,
  /重要/u,
  /什么样/u,
  /怎样的人/u,
  /性格/u,
  /状态/u,
  /复盘/u,
  /总结/u,
  /人生/u
];
const EVALUATIVE_PROFILE_QUESTION_PATTERNS = [
  /优点/u,
  /优势/u,
  /长处/u,
  /缺点/u,
  /不足/u,
  /短板/u,
  /弱点/u,
  /问题/u,
  /评价/u,
  /看法/u,
  /建议/u,
  /适合/u,
  /不适合/u
];
const BROAD_PROFILE_EXPANSION_TEXT = [
  '年度总结 年终总结 这一年 我的20 复盘 成长 改变 变化 转折 经历',
  '焦虑 秩序 信心 重新出发 继续向前 考试 复试 工作 生活 状态',
  '计划 目标 方向 自我修复 主动复盘 重要事件 重大事件'
].join(' ');
const EVALUATIVE_PROFILE_EXPANSION_TEXT = [
  '优点 优势 长处 缺点 不足 短板 弱点 评价 看法 建议',
  '焦虑 秩序 信心 状态 执行 计划 目标 方向 反思 复盘',
  '工作 考试 生活 成长 压力 情绪 自我修复 继续向前'
].join(' ');
const ANNUAL_SUMMARY_PATTERN = /这一年|我的20|年度|年终|总结|复盘|重新出发|继续向前|焦虑|秩序|信心|考试|复试|工作|生活|计划|目标|方向|优点|缺点|不足|短板|建议|评价/u;

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function stripMarkdown(value) {
  return cleanText(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSearchText(value) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  const normalized = normalizeSearchText(value);
  const tokens = new Set();
  for (const token of normalized.match(/[a-z0-9]{2,}/g) || []) {
    tokens.add(token);
  }
  for (const segment of normalized.match(/[\p{Script=Han}]+/gu) || []) {
    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index <= segment.length - size; index += 1) {
        tokens.add(segment.slice(index, index + size));
      }
    }
    for (const char of segment) {
      if (!STOP_CHARS.has(char)) tokens.add(char);
    }
  }
  return [...tokens];
}

function isBroadProfileQuestion(question) {
  const text = cleanText(question);
  return BROAD_PROFILE_QUESTION_PATTERNS.some((pattern) => pattern.test(text));
}

function isEvaluativeProfileQuestion(question) {
  const text = cleanText(question);
  return EVALUATIVE_PROFILE_QUESTION_PATTERNS.some((pattern) => pattern.test(text));
}

function stripSearchFields({ tokens: _tokens, searchText: _searchText, ...chunk }) {
  return chunk;
}

function scoreAnnualSummaryFallback(chunk) {
  const source = `${cleanText(chunk.articleTitle)}\n${cleanText(chunk.text)}`;
  if (!ANNUAL_SUMMARY_PATTERN.test(source)) return 0;

  let score = 10;
  if (/这一年|年度|年终|总结|复盘/u.test(source)) score += 18;
  if (/焦虑|秩序|信心|重新出发|主动复盘|继续向前/u.test(source)) score += 12;
  if (/考试|复试|工作|生活|计划|目标|方向/u.test(source)) score += 8;
  if (/20\d{2}/u.test(cleanText(chunk.articleTitle))) score += 6;
  return score;
}

function splitLongText(text, chunkSize, overlap) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
  const paragraphs = stripMarkdown(text)
    .split(/\n{2,}|\n|(?<=[。！？!?])\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      chunks.push(...splitLongText(paragraph, chunkSize, overlap));
      continue;
    }
    const next = current ? `${current}\n${paragraph}` : paragraph;
    if (next.length > chunkSize && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

function articleKnowledgeSource(article) {
  return [
    cleanText(article.title),
    cleanText(article.subtitle),
    cleanText(article.excerpt),
    stripMarkdown(article.content),
    cleanText(article.aiReview?.content)
  ].filter(Boolean).join('\n\n');
}

function publicArticlePayload(article) {
  return {
    id: cleanText(article.id),
    title: cleanText(article.title),
    subtitle: cleanText(article.subtitle),
    slug: cleanText(article.slug || article.id),
    excerpt: cleanText(article.excerpt),
    content: String(article.content || ''),
    aiReview: article.aiReview || {},
    status: article.status === 'draft' ? 'draft' : 'published',
    updatedAt: cleanText(article.updatedAt)
  };
}

export function buildProfileKnowledgeIndex(articles = [], {
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP
} = {}) {
  const published = articles
    .map(publicArticlePayload)
    .filter((article) => article.status !== 'draft')
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  const chunks = [];
  for (const article of published) {
    const source = articleKnowledgeSource(article);
    const parts = chunkText(source, chunkSize, overlap);
    parts.forEach((text, index) => {
      const searchText = normalizeSearchText([
        article.title,
        article.subtitle,
        article.excerpt,
        text
      ].join('\n'));
      chunks.push({
        id: `${article.id || article.slug || 'article'}-${index}`,
        articleId: article.id,
        articleTitle: article.title,
        articleSlug: article.slug,
        updatedAt: article.updatedAt,
        text,
        searchText,
        tokens: tokenize(searchText)
      });
    });
  }

  const sourceHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(published.map((article) => ({
      id: article.id,
      title: article.title,
      subtitle: article.subtitle,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      aiReview: article.aiReview?.content,
      updatedAt: article.updatedAt
    }))), 'utf8')
    .digest('hex');

  return {
    formatVersion: PROFILE_CHAT_FORMAT_VERSION,
    sourceHash,
    articleCount: published.length,
    chunks
  };
}

function scoreChunk(chunk, question, questionTokens) {
  const normalizedQuestion = normalizeSearchText(question);
  const tokenSet = new Set(chunk.tokens || tokenize(chunk.searchText));
  const questionYears = question.match(/20\d{2}/g) || [];
  const articleYears = cleanText(chunk.articleTitle).match(/20\d{2}/g) || [];
  let score = 0;

  if (normalizedQuestion && chunk.searchText.includes(normalizedQuestion)) {
    score += 16;
  }

  for (const token of questionTokens) {
    if (tokenSet.has(token) || chunk.searchText.includes(token)) {
      score += token.length >= 2 ? 4 + Math.min(token.length, 4) : 1;
    }
  }

  if (questionYears.length) {
    for (const year of questionYears) {
      if (chunk.articleTitle.includes(year)) {
        score += 42;
      } else if (chunk.text.includes(year)) {
        score += 8;
      }
    }
    if (articleYears.length && !articleYears.some((year) => questionYears.includes(year))) {
      score -= 18;
    }
  }

  return score;
}

export function findRelevantProfileKnowledge(indexOrArticles, question, {
  limit = 6,
  minScore = 4
} = {}) {
  const index = Array.isArray(indexOrArticles)
    ? buildProfileKnowledgeIndex(indexOrArticles)
    : indexOrArticles;
  const broadQuestion = isBroadProfileQuestion(question);
  const evaluativeQuestion = isEvaluativeProfileQuestion(question);
  const expansionText = [
    broadQuestion ? BROAD_PROFILE_EXPANSION_TEXT : '',
    evaluativeQuestion ? EVALUATIVE_PROFILE_EXPANSION_TEXT : ''
  ].filter(Boolean).join('\n');
  const questionTokens = tokenize(expansionText ? `${question}\n${expansionText}` : question);
  if (!index?.chunks?.length || questionTokens.length === 0) return [];

  const scored = index.chunks
    .map((chunk) => ({ ...chunk, score: scoreChunk(chunk, question, questionTokens) }))
    .sort((a, b) => b.score - a.score || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const hits = scored.filter((chunk) => chunk.score >= minScore);
  const fallbackHits = (broadQuestion || evaluativeQuestion) && hits.length === 0
    ? scored
      .map((chunk) => ({
        ...chunk,
        score: scoreAnnualSummaryFallback(chunk)
      }))
      .filter((chunk) => chunk.score > 0)
      .sort((a, b) => b.score - a.score || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    : hits;

  return fallbackHits
    .slice(0, limit)
    .map(stripSearchFields);
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
      request.destroy(new Error('DeepSeek profile chat request timed out'));
    });
    request.write(body);
    request.end();
  });
}

function uniqueSources(hits) {
  const seen = new Set();
  const sources = [];
  for (const hit of hits) {
    const key = hit.articleId || hit.articleSlug || hit.articleTitle;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    sources.push({
      id: hit.articleId,
      title: hit.articleTitle,
      slug: hit.articleSlug,
      updatedAt: hit.updatedAt
    });
  }
  return sources.slice(0, 4);
}

function buildUserPrompt(question, hits) {
  const snippets = hits.map((hit, index) => [
    `[${index + 1}] 文章：《${hit.articleTitle}》`,
    hit.updatedAt ? `更新时间：${hit.updatedAt}` : '',
    `片段：${hit.text}`
  ].filter(Boolean).join('\n')).join('\n\n');

  return [
    `用户问题：${question}`,
    '',
    '参考知识片段：',
    snippets
  ].join('\n');
}

export async function answerProfileQuestion(question, articles = [], {
  env = process.env,
  fetchImpl = globalThis.fetch,
  index = null
} = {}) {
  const cleanQuestion = cleanText(question).slice(0, 500);
  if (!cleanQuestion) {
    throw new Error('question is required');
  }

  const knowledgeIndex = index || buildProfileKnowledgeIndex(articles);
  const hits = findRelevantProfileKnowledge(knowledgeIndex, cleanQuestion);
  if (hits.length === 0) {
    return {
      answer: UNKNOWN_PROFILE_ANSWER,
      sources: [],
      sourceHash: knowledgeIndex.sourceHash,
      model: '',
      formatVersion: PROFILE_CHAT_FORMAT_VERSION
    };
  }

  const apiKey = cleanText(env.DEEPSEEK_API_KEY);
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const apiUrl = cleanText(env.DEEPSEEK_API_URL, DEFAULT_DEEPSEEK_API_URL);
  const model = cleanText(env.DEEPSEEK_MODEL, DEFAULT_DEEPSEEK_MODEL);
  const payload = {
    model,
    messages: [
      { role: 'system', content: PROFILE_CHAT_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(cleanQuestion, hits) }
    ],
    temperature: 0.35,
    max_tokens: PROFILE_CHAT_MAX_TOKENS
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
    throw new Error(`DeepSeek profile chat request failed with status ${response.status}`);
  }

  const data = await response.json();
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('DeepSeek profile chat response was truncated by max_tokens');
  }
  const answer = cleanText(choice?.message?.content, UNKNOWN_PROFILE_ANSWER);
  if (answer.includes(UNKNOWN_PROFILE_ANSWER)) {
    return {
      answer: UNKNOWN_PROFILE_ANSWER,
      sources: [],
      sourceHash: knowledgeIndex.sourceHash,
      model,
      formatVersion: PROFILE_CHAT_FORMAT_VERSION
    };
  }

  return {
    answer,
    sources: uniqueSources(hits),
    sourceHash: knowledgeIndex.sourceHash,
    model,
    formatVersion: PROFILE_CHAT_FORMAT_VERSION
  };
}
