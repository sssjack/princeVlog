import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStore } from '../server/store.js';

let tempDir;
let store;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'princevlog-store-'));
  store = createStore(path.join(tempDir, 'data.json'));
  await store.init();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('content store', () => {
  it('creates article categories and returns articles grouped by category slug', async () => {
    const category = await store.createCategory({ name: '旅行手记', slug: 'travel', description: '路上的故事' });
    await store.createArticle({
      title: '第一次远行',
      subtitle: '把风景写进生活',
      slug: 'first-trip',
      coverUrl: '/uploads/cover.jpg',
      categoryId: category.id,
      content: '# 出发\n\n今天很晴朗。',
      recommended: true,
      status: 'published'
    });

    const articles = await store.listArticles({ categorySlug: 'travel' });

    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      title: '第一次远行',
      categoryName: '旅行手记',
      recommended: true
    });
  });

  it('keeps album photos queryable by folder and date', async () => {
    const album = await store.createAlbum({ title: '城市夜色', folder: 'night-city', description: '灯光和晚风' });
    await store.createPhoto({
      albumId: album.id,
      title: '天桥',
      imageUrl: '/uploads/photos/bridge.jpg',
      shotAt: '2026-05-20'
    });

    const byFolder = await store.listAlbums({ mode: 'folder' });
    const byDate = await store.listAlbums({ mode: 'date' });

    expect(byFolder[0].photos[0].title).toBe('天桥');
    expect(byDate[0].date).toBe('2026-05-20');
  });

  it('supports public comments and admin replies', async () => {
    const category = await store.createCategory({ name: '随笔', slug: 'notes' });
    const article = await store.createArticle({
      title: '一段文字',
      slug: 'a-note',
      categoryId: category.id,
      content: 'Hello',
      status: 'published'
    });
    const comment = await store.createComment({ articleId: article.id, author: '访客', content: '写得真好' });

    await store.replyComment(comment.id, '谢谢你，也祝你今天顺利。');
    const comments = await store.listComments({ articleId: article.id });

    expect(comments[0].reply).toBe('谢谢你，也祝你今天顺利。');
  });

  it('records visits with ip, province, route and timestamp', async () => {
    await store.recordVisit({
      ip: '8.8.8.8',
      country: '美国',
      province: 'California',
      path: '/princevlog/articles/a-note',
      userAgent: 'vitest'
    });

    const analytics = await store.getAnalytics();

    expect(analytics.totalRequests).toBe(1);
    expect(analytics.uniqueVisitors).toBe(1);
    expect(analytics.recentVisits[0]).toMatchObject({
      ip: '8.8.8.8',
      country: '美国',
      province: 'California'
    });
    expect(analytics.requestTrend).toHaveLength(7);
    expect(analytics.requestTrend.at(-1)).toMatchObject({
      date: new Date().toISOString().slice(0, 10),
      count: 1
    });
  });

  it('defaults the analytics recent visit list to the latest 50 records', async () => {
    for (let index = 0; index < 55; index += 1) {
      await store.recordVisit({
        ip: `203.0.113.${index}`,
        country: '中国',
        province: `测试省${index}`,
        path: `/princevlog/path-${index}`
      });
    }

    const analytics = await store.getAnalytics();

    expect(analytics.recentVisits).toHaveLength(50);
    expect(analytics.recentVisits[0]).toMatchObject({
      country: '中国',
      province: '测试省54',
      path: '/princevlog/path-54'
    });
    expect(analytics.recentVisits.at(-1)).toMatchObject({
      country: '中国',
      province: '测试省5',
      path: '/princevlog/path-5'
    });
  });
});
