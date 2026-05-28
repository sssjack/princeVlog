const ANNUAL_TITLE_PATTERN = /^这一年--.*?(20\d{2})/;
const DATE_PATTERN = /(?:(20\d{2}|\d{2})年)?\s*(\d{1,2})月\s*(?:(\d{1,2})[日号]|(月初|上旬|上半月|初|月中|中旬|下旬|下半月|月底|末|份))?/;
const QUALIFIER_DAYS = {
  月初: 5,
  上旬: 5,
  上半月: 5,
  初: 5,
  月中: 15,
  中旬: 15,
  下旬: 25,
  下半月: 25,
  月底: 28,
  末: 28
};
const CONTEXT_SECTION_PATTERN = /(所处的世界|我们所处的世界|世界也并不太平|国家社会世界|社会世界)/;
const PUBLIC_CONTEXT_PATTERN = /(天文学家|黑洞|美国|日本政府|联合国|世界卫生组织|WHO|SpaceX|星舰|中美元首|巴勒斯坦|以色列|哈马斯|中共中央|国务院|全国人大|国家统计局|国家卫健委|中央经济工作会议|Facebook|Meta|IMF|纽约时报|民进党|三方联合声明|人口普查|防控相关措施|贸易黑名单|列入黑名单|发布公告|公布|宣布|通过|发射|会晤|政策法案|安全保障文件)/;
const PERSONAL_CONTEXT_PATTERN = /(我|我们|自己|父母|妈妈|爸爸|朋友|同事|老师|家人|上家公司|这家公司|我们公司|公司通知|主管|老板|人事|工资|面试|上班|下班|离职|入职|裁员|赔偿|仲裁|考试|自考|科三|学位|本科|研究生|考研|国考|省考|复试|补录|报名|成绩|合格|过线|来到|去了|坐上|买了|入手|搬|威海|深圳|济南|广州|长沙|熊哥|萌萌|金总|诗总|坤哥|马哥|萍总|零车|佳豪|小米)/;
const FEATURED_EVENT_PATTERNS = [
  /第一次|人生.*第一次|第一份工作|第一台电脑/,
  /成功|过线|合格|补录|通过|达成|拿到|申请.*成功/,
  /研究生|考研|复试|国考|省考|自考.*最后一科|学位|本科毕业|毕业证/,
  /入职|离职|结束了.*工作|赔偿金|劳动仲裁|公司解散|创业失败/,
  /开启.*人生|下一段人生旅程|二次深漂|来到.*济南|坐上.*航班/,
  /买了第一台电脑|正式入手|存款目标正式达成/
];
const ROUTINE_EVENT_PATTERN = /(第二次考试|第三次考试|报名了考驾照|开始准备|重新整理计划|练习|了解到|咨询|打电话询问)/;

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

function headingFromLine(line) {
  const match = cleanText(line).match(/^(#{1,6})\s*(.+)$/);
  if (!match) return null;
  return {
    level: match[1].length,
    title: stripMarkdown(match[2])
  };
}

function isContextSectionHeading(line) {
  const heading = headingFromLine(line);
  if (!heading) return false;
  return CONTEXT_SECTION_PATTERN.test(heading.title)
    || (/今年/.test(heading.title) && /世界/.test(heading.title));
}

function yearFromTitle(title) {
  const match = cleanText(title).match(ANNUAL_TITLE_PATTERN);
  return match ? Number(match[1]) : null;
}

function datePartsFromLine(line, fallbackYear) {
  const match = cleanText(line).match(DATE_PATTERN);
  if (!match) return null;

  const matchedYear = match[1]
    ? (match[1].length === 2 ? Number(`20${match[1]}`) : Number(match[1]))
    : Number(fallbackYear);
  const year = matchedYear;
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
    || /^写于/.test(text)
    || /^#{1,6}\s*目录/.test(text)
    || /^[-*]\s*[一二三四五六七八九十]+[、.]/.test(text)
    || /^[-*]\s*(前言|总结|明年|今年|这一年|这年)/.test(text);
}

function isContextOnlyLine(line) {
  const text = stripMarkdown(line);
  return PUBLIC_CONTEXT_PATTERN.test(text) && !PERSONAL_CONTEXT_PATTERN.test(text);
}

function isFeaturedEvent(detail) {
  const text = stripMarkdown(detail);
  if (!text || ROUTINE_EVENT_PATTERN.test(text)) return false;
  return FEATURED_EVENT_PATTERNS.some((pattern) => pattern.test(text));
}

function eventTitleFromLine(line, dateLabel) {
  const text = stripMarkdown(line);
  const dateIndex = text.indexOf(dateLabel);
  const candidate = (() => {
    if (dateIndex < 0 || dateIndex > 8) return text;
    const beforeDate = cleanText(text.slice(0, dateIndex));
    if (beforeDate && !/^(这年|这年的|今年|同样是|到了这年的|到了|从|在|于)$/.test(beforeDate)) {
      return text;
    }
    return text.slice(dateIndex + dateLabel.length);
  })();
  const withoutLead = cleanText(candidate)
    .replace(/^[，,。：:；;\s-]+/, '')
    .replace(/^(的)?(一天|某天|这天|早上|早|晚|上午|下午|晚上)[，,、\s]*/, '')
    .replace(/^的(?=[\u4e00-\u9fa5A-Za-z0-9])/, '');
  const firstSentence = cleanText(withoutLead.split(/[。！？!?；;]/)[0], withoutLead);
  return firstSentence || `${dateLabel} 的记录`;
}

export function extractArticleTimelineEvents(article, { titleOverrides = {} } = {}) {
  const articleYear = yearFromTitle(article?.title);
  if (!articleYear) return [];

  const lines = cleanText(article.content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const events = [];
  const seen = new Set();
  let contextSectionLevel = null;
  for (const line of lines) {
    const heading = headingFromLine(line);
    if (heading) {
      if (contextSectionLevel !== null && heading.level <= contextSectionLevel) {
        contextSectionLevel = null;
      }
      if (isContextSectionHeading(line)) {
        contextSectionLevel = heading.level;
        continue;
      }
    }
    if (contextSectionLevel !== null) continue;
    if (isSkippableLine(line)) continue;
    const dateParts = datePartsFromLine(line, articleYear);
    if (!dateParts || dateParts.year !== articleYear) continue;
    if (isContextOnlyLine(line)) continue;

    const detail = stripMarkdown(line).slice(0, 420);
    if (detail.length < 8) continue;

    const key = `${dateParts.date}-${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const index = events.length + 1;
    const id = `${article.slug || article.id}-${dateParts.date}-${index}`;
    const fallbackTitle = eventTitleFromLine(line, dateParts.dateLabel);
    const overrideTitle = cleanText(titleOverrides[id]);
    events.push({
      id,
      ...dateParts,
      title: overrideTitle || fallbackTitle,
      detail,
      featured: isFeaturedEvent(detail),
      articleId: article.id,
      articleTitle: article.title,
      articleSlug: article.slug || article.id,
      articleExcerpt: cleanText(article.excerpt)
    });
  }

  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export function createAnnualTimeline(articles = [], { titleOverrides = {} } = {}) {
  const groups = new Map();
  for (const article of articles) {
    const year = yearFromTitle(article?.title);
    if (!year || article.status === 'draft') continue;
    const events = extractArticleTimelineEvents(article, { titleOverrides });
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
