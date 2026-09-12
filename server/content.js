export const CONTENT_KINDS = ['moments', 'years', 'projects', 'trips'];
export const isPublic = (item) =>
  item?.visibility !== 'private' && item?.status !== 'draft';

export function articleYear(article) {
  return String(
    article.year ||
      (/年终|年度|这一年|year-review/.test(`${article.title} ${article.slug}`)
        ? `${article.title} ${article.slug}`.match(/20\d{2}/)?.[0]
        : '') ||
      article.createdAt?.slice(0, 4) ||
      '',
  );
}

export function normalizeEntry(input, previous = {}) {
  const result = {};
  for (const key of [
    'title',
    'content',
    'imageUrl',
    'theme',
    'reflection',
    'purpose',
    'contribution',
    'outcome',
    'url',
    'place',
  ]) {
    result[key] = String(input[key] ?? previous[key] ?? '').trim();
  }
  result.date = String(
    input.date ?? previous.date ?? new Date().toISOString().slice(0, 10),
  );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result.date) ||
    Number.isNaN(Date.parse(result.date)) ||
    new Date(result.date).toISOString().slice(0, 10) !== result.date
  )
    throw new Error('请输入有效日期');
  result.year = String(input.year ?? previous.year ?? result.date.slice(0, 4));
  if (!/^(19|20)\d{2}$/.test(result.year)) throw new Error('请输入有效年份');
  result.visibility =
    (input.visibility ?? previous.visibility) === 'public'
      ? 'public'
      : 'private';
  result.status =
    (input.status ?? previous.status) === 'published' ? 'published' : 'draft';
  for (const key of ['articleIds', 'albumIds', 'photoIds']) {
    result[key] = Array.isArray(input[key] ?? previous[key])
      ? [...new Set((input[key] ?? previous[key]).map(String))]
      : [];
  }
  if (result.url && !/^https?:\/\//i.test(result.url))
    throw new Error('作品链接须以 http:// 或 https:// 开头');
  return result;
}
