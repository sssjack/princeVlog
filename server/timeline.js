const ANNUAL_TITLE_PATTERN = /^这一年--.*?(20\d{2})/;
const DATE_PATTERN = /(?:(20\d{2})年)?\s*(\d{1,2})月\s*(?:(\d{1,2})[日号]|(初|中旬|下旬|末|份))?/;
const QUALIFIER_DAYS = {
  初: 5,
  中旬: 15,
  下旬: 25,
  末: 28
};

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function stripMarkdown(value) {
  return cleanText(value)
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+[.、]\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function yearFromTitle(title) {
  const match = cleanText(title).match(ANNUAL_TITLE_PATTERN);
  return match ? Number(match[1]) : null;
}

function datePartsFromLine(line, fallbackYear) {
  const match = cleanText(line).match(DATE_PATTERN);
  if (!match) return null;

  const year = Number(match[1] || fallbackYear);
  const month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : QUALIFIER_DAYS[match[4]] || 1;
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const qualifier = match[4] || '';
  return {
    year,
    month,
    day,
    date: `${year}-${pad(month)}-${pad(day)}`,
    dateLabel: match[0].replace(/\s+/g, ''),
    precision: match[3] ? 'day' : (qualifier && qualifier !== '份' ? 'period' : 'month')
  };
}

function isSkippableLine(line) {
  const text = cleanText(line);
  return !text
    || /^#{1,6}\s*目录/.test(text)
    || /^[-*]\s*[一二三四五六七八九十]+[、.]/.test(text)
    || /^[-*]\s*(前言|总结|明年|今年|这一年|这年)/.test(text);
}

function eventTitleFromLine(line, dateLabel) {
  const text = stripMarkdown(line);
  const dateIndex = text.indexOf(dateLabel);
  const candidate = dateIndex >= 0 && dateIndex <= 8
    ? text.slice(dateIndex + dateLabel.length)
    : text;
  const withoutLead = cleanText(candidate).replace(/^[，,。：:；;\s-]+/, '');
  const firstSentence = cleanText(withoutLead.split(/[。！？!?；;]/)[0], withoutLead);
  return firstSentence.slice(0, 42) || `${dateLabel} 的记录`;
}

export function extractArticleTimelineEvents(article) {
  const articleYear = yearFromTitle(article?.title);
  if (!articleYear) return [];

  const lines = cleanText(article.content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const events = [];
  const seen = new Set();
  for (const line of lines) {
    if (isSkippableLine(line)) continue;
    const dateParts = datePartsFromLine(line, articleYear);
    if (!dateParts || dateParts.year !== articleYear) continue;

    const detail = stripMarkdown(line).slice(0, 420);
    if (detail.length < 8) continue;

    const key = `${dateParts.date}-${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const index = events.length + 1;
    events.push({
      id: `${article.slug || article.id}-${dateParts.date}-${index}`,
      ...dateParts,
      title: eventTitleFromLine(line, dateParts.dateLabel),
      detail,
      articleId: article.id,
      articleTitle: article.title,
      articleSlug: article.slug || article.id,
      articleExcerpt: cleanText(article.excerpt)
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function createAnnualTimeline(articles = []) {
  const groups = new Map();
  for (const article of articles) {
    const year = yearFromTitle(article?.title);
    if (!year || article.status === 'draft') continue;
    const events = extractArticleTimelineEvents(article);
    if (events.length === 0) continue;
    groups.set(year, {
      year,
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug || article.id,
        excerpt: cleanText(article.excerpt),
        updatedAt: article.updatedAt
      },
      events
    });
  }

  const years = [...groups.values()].sort((a, b) => b.year - a.year);
  return {
    years,
    totalEvents: years.reduce((sum, group) => sum + group.events.length, 0)
  };
}
