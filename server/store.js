import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { locationForIp } from './geo.js';

const MAX_VISITS = 10000;

function now() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID();
}

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function toBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function displayProvince(visit) {
  const province = cleanText(visit.province);
  if (!province || province === '??' || /^[A-Z]{2}$/.test(province)) {
    return locationForIp(visit.ip).province;
  }
  return province;
}

function displayCountry(visit) {
  const country = cleanText(visit.country);
  if (!country || country === '??') {
    return locationForIp(visit.ip).country;
  }
  return country;
}

function dateOnly(value) {
  const text = cleanText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return now().slice(0, 10);
}

function makeSlug(value, fallback) {
  const slug = cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback || id().slice(0, 8);
}

function demoContent() {
  const categoryId = id();
  const articleId = id();
  const albumId = id();
  const createdAt = now();

  return {
    categories: [
      {
        id: categoryId,
        name: '生活随笔',
        slug: 'life-notes',
        description: '日常、观点和阶段性的想法。',
        createdAt,
        updatedAt: createdAt
      }
    ],
    articles: [
      {
        id: articleId,
        title: '欢迎来到 PrinceVlog',
        subtitle: '第一篇文章，也是新的开始',
        slug: 'welcome-to-princevlog',
        coverUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80',
        categoryId,
        content: '# 欢迎\n\n这里会记录我的文章、照片和一路上的观察。\n\n- 文章支持 Markdown\n- 后台可以维护分类、封面和推荐\n- 访客可以评论，我可以在后台回复',
        excerpt: '一个新的个人博客开始运转。',
        recommended: true,
        status: 'published',
        viewCount: 0,
        createdAt,
        updatedAt: createdAt
      }
    ],
    albums: [
      {
        id: albumId,
        title: '示例相簿',
        folder: 'featured',
        description: '上线后可在后台上传自己的照片。',
        coverUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
        createdAt,
        updatedAt: createdAt
      }
    ],
    photos: [
      {
        id: id(),
        albumId,
        title: '城市光影',
        caption: '夜色里的线条和秩序。',
        imageUrl: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1000&q=80',
        shotAt: dateOnly(createdAt),
        createdAt,
        updatedAt: createdAt
      }
    ]
  };
}

function defaultData(seedDemo = false) {
  const demo = seedDemo ? demoContent() : {};

  return {
    settings: {
      siteTitle: 'PrinceVlog',
      heroSubtitle: '记录一路上的见闻、灵感、照片和长期主义。',
      ownerName: 'Prince',
      mottoes: [
        '把时间花在热爱的事情上，答案会慢慢长出来。',
        '看见更大的世界，也照顾好眼前的生活。',
        '保持好奇，保持清醒，保持向前。'
      ]
    },
    categories: demo.categories || [],
    articles: demo.articles || [],
    albums: demo.albums || [],
    photos: demo.photos || [],
    comments: [],
    messages: [],
    visits: []
  };
}

function normalizeData(data) {
  const base = defaultData();
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data?.settings || {}) },
    categories: Array.isArray(data?.categories) ? data.categories : [],
    articles: Array.isArray(data?.articles) ? data.articles : [],
    albums: Array.isArray(data?.albums) ? data.albums : [],
    photos: Array.isArray(data?.photos) ? data.photos : [],
    comments: Array.isArray(data?.comments) ? data.comments : [],
    messages: Array.isArray(data?.messages) ? data.messages : [],
    visits: Array.isArray(data?.visits) ? data.visits : []
  };
}

export function createStore(dbPath, { seedDemo = false } = {}) {
  let data = null;
  let writeChain = Promise.resolve();

  async function persist() {
    await mkdir(path.dirname(dbPath), { recursive: true });
    const tmpPath = `${dbPath}.${process.pid}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    await rename(tmpPath, dbPath);
  }

  function enqueueWrite(fn) {
    writeChain = writeChain.then(async () => {
      const result = await fn();
      await persist();
      return result;
    });
    return writeChain;
  }

  function categoryFor(article) {
    return data.categories.find((category) => category.id === article.categoryId) || null;
  }

  function projectArticle(article) {
    const category = categoryFor(article);
    return {
      ...article,
      categoryName: category?.name || '未分类',
      categorySlug: category?.slug || ''
    };
  }

  function assertUniqueSlug(collection, slug, currentId) {
    const exists = collection.some((item) => item.slug === slug && item.id !== currentId);
    if (exists) {
      throw new Error(`slug already exists: ${slug}`);
    }
  }

  const api = {
    async init() {
      await mkdir(path.dirname(dbPath), { recursive: true });
      try {
        const raw = await readFile(dbPath, 'utf8');
        data = normalizeData(JSON.parse(raw));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        data = defaultData(seedDemo);
        await persist();
      }
      return api;
    },

    async getSettings() {
      return data.settings;
    },

    async updateSettings(nextSettings) {
      return enqueueWrite(async () => {
        data.settings = {
          ...data.settings,
          ...nextSettings,
          mottoes: Array.isArray(nextSettings.mottoes)
            ? nextSettings.mottoes.map((item) => cleanText(item)).filter(Boolean)
            : data.settings.mottoes
        };
        return data.settings;
      });
    },

    async listCategories() {
      return [...data.categories].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    },

    async createCategory(input) {
      return enqueueWrite(async () => {
        const timestamp = now();
        const category = {
          id: id(),
          name: cleanText(input.name, '未命名分类'),
          slug: makeSlug(input.slug || input.name),
          description: cleanText(input.description),
          createdAt: timestamp,
          updatedAt: timestamp
        };
        assertUniqueSlug(data.categories, category.slug);
        data.categories.push(category);
        return category;
      });
    },

    async updateCategory(categoryId, input) {
      return enqueueWrite(async () => {
        const category = data.categories.find((item) => item.id === categoryId);
        if (!category) throw new Error('category not found');
        const nextSlug = makeSlug(input.slug || input.name || category.slug);
        assertUniqueSlug(data.categories, nextSlug, categoryId);
        Object.assign(category, {
          name: cleanText(input.name, category.name),
          slug: nextSlug,
          description: cleanText(input.description, category.description),
          updatedAt: now()
        });
        return category;
      });
    },

    async deleteCategory(categoryId) {
      return enqueueWrite(async () => {
        data.categories = data.categories.filter((item) => item.id !== categoryId);
        data.articles = data.articles.map((article) => (
          article.categoryId === categoryId ? { ...article, categoryId: '' } : article
        ));
        return { ok: true };
      });
    },

    async listArticles({ categorySlug, recommended, includeDrafts = false, search } = {}) {
      const normalizedSearch = cleanText(search).toLowerCase();
      return data.articles
        .filter((article) => includeDrafts || article.status === 'published')
        .filter((article) => {
          if (!categorySlug) return true;
          return categoryFor(article)?.slug === categorySlug;
        })
        .filter((article) => recommended === undefined || article.recommended === toBool(recommended))
        .filter((article) => {
          if (!normalizedSearch) return true;
          return `${article.title} ${article.subtitle} ${article.excerpt}`.toLowerCase().includes(normalizedSearch);
        })
        .map(projectArticle)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    },

    async getArticle(identifier, { includeDrafts = false } = {}) {
      const article = data.articles.find((item) => item.id === identifier || item.slug === identifier);
      if (!article || (!includeDrafts && article.status !== 'published')) return null;
      return projectArticle(article);
    },

    async createArticle(input) {
      return enqueueWrite(async () => {
        const timestamp = now();
        const article = {
          id: id(),
          title: cleanText(input.title, '未命名文章'),
          subtitle: cleanText(input.subtitle),
          slug: makeSlug(input.slug || input.title),
          coverUrl: cleanText(input.coverUrl),
          categoryId: cleanText(input.categoryId),
          content: String(input.content || ''),
          excerpt: cleanText(input.excerpt),
          recommended: toBool(input.recommended),
          status: input.status === 'draft' ? 'draft' : 'published',
          viewCount: 0,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        assertUniqueSlug(data.articles, article.slug);
        data.articles.push(article);
        return projectArticle(article);
      });
    },

    async updateArticle(articleId, input) {
      return enqueueWrite(async () => {
        const article = data.articles.find((item) => item.id === articleId);
        if (!article) throw new Error('article not found');
        const nextSlug = makeSlug(input.slug || article.slug);
        assertUniqueSlug(data.articles, nextSlug, articleId);
        Object.assign(article, {
          title: cleanText(input.title, article.title),
          subtitle: cleanText(input.subtitle, article.subtitle),
          slug: nextSlug,
          coverUrl: cleanText(input.coverUrl, article.coverUrl),
          categoryId: cleanText(input.categoryId, article.categoryId),
          content: input.content === undefined ? article.content : String(input.content),
          excerpt: cleanText(input.excerpt, article.excerpt),
          recommended: input.recommended === undefined ? article.recommended : toBool(input.recommended),
          status: input.status === 'draft' ? 'draft' : 'published',
          updatedAt: now()
        });
        return projectArticle(article);
      });
    },

    async incrementArticleView(articleId) {
      return enqueueWrite(async () => {
        const article = data.articles.find((item) => item.id === articleId);
        if (!article) return null;
        article.viewCount = Number(article.viewCount || 0) + 1;
        return projectArticle(article);
      });
    },

    async deleteArticle(articleId) {
      return enqueueWrite(async () => {
        data.articles = data.articles.filter((item) => item.id !== articleId);
        data.comments = data.comments.filter((item) => item.articleId !== articleId);
        return { ok: true };
      });
    },

    async createAlbum(input) {
      return enqueueWrite(async () => {
        const timestamp = now();
        const album = {
          id: id(),
          title: cleanText(input.title, '未命名相簿'),
          folder: makeSlug(input.folder || input.title),
          description: cleanText(input.description),
          coverUrl: cleanText(input.coverUrl),
          createdAt: timestamp,
          updatedAt: timestamp
        };
        data.albums.push(album);
        return album;
      });
    },

    async updateAlbum(albumId, input) {
      return enqueueWrite(async () => {
        const album = data.albums.find((item) => item.id === albumId);
        if (!album) throw new Error('album not found');
        Object.assign(album, {
          title: cleanText(input.title, album.title),
          folder: makeSlug(input.folder || album.folder),
          description: cleanText(input.description, album.description),
          coverUrl: cleanText(input.coverUrl, album.coverUrl),
          updatedAt: now()
        });
        return album;
      });
    },

    async deleteAlbum(albumId) {
      return enqueueWrite(async () => {
        data.albums = data.albums.filter((item) => item.id !== albumId);
        data.photos = data.photos.filter((item) => item.albumId !== albumId);
        return { ok: true };
      });
    },

    async createPhoto(input) {
      return enqueueWrite(async () => {
        const timestamp = now();
        const photo = {
          id: id(),
          albumId: cleanText(input.albumId),
          title: cleanText(input.title, '未命名照片'),
          caption: cleanText(input.caption),
          imageUrl: cleanText(input.imageUrl),
          shotAt: dateOnly(input.shotAt),
          createdAt: timestamp,
          updatedAt: timestamp
        };
        data.photos.push(photo);
        return photo;
      });
    },

    async updatePhoto(photoId, input) {
      return enqueueWrite(async () => {
        const photo = data.photos.find((item) => item.id === photoId);
        if (!photo) throw new Error('photo not found');
        Object.assign(photo, {
          albumId: cleanText(input.albumId, photo.albumId),
          title: cleanText(input.title, photo.title),
          caption: cleanText(input.caption, photo.caption),
          imageUrl: cleanText(input.imageUrl, photo.imageUrl),
          shotAt: input.shotAt ? dateOnly(input.shotAt) : photo.shotAt,
          updatedAt: now()
        });
        return photo;
      });
    },

    async deletePhoto(photoId) {
      return enqueueWrite(async () => {
        data.photos = data.photos.filter((item) => item.id !== photoId);
        return { ok: true };
      });
    },

    async listAlbums({ mode = 'folder' } = {}) {
      if (mode === 'date') {
        const grouped = new Map();
        for (const photo of data.photos) {
          const key = dateOnly(photo.shotAt || photo.createdAt);
          grouped.set(key, [...(grouped.get(key) || []), photo]);
        }
        return [...grouped.entries()]
          .map(([date, photos]) => ({ date, photos: photos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) }))
          .sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      return data.albums
        .map((album) => ({
          ...album,
          photos: data.photos
            .filter((photo) => photo.albumId === album.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        }))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    },

    async createComment(input) {
      return enqueueWrite(async () => {
        const timestamp = now();
        const comment = {
          id: id(),
          articleId: cleanText(input.articleId),
          author: cleanText(input.author, '匿名访客').slice(0, 40),
          content: cleanText(input.content).slice(0, 1000),
          reply: '',
          createdAt: timestamp,
          updatedAt: timestamp
        };
        data.comments.push(comment);
        return comment;
      });
    },

    async listComments({ articleId } = {}) {
      return data.comments
        .filter((comment) => !articleId || comment.articleId === articleId)
        .map((comment) => ({
          ...comment,
          articleTitle: data.articles.find((article) => article.id === comment.articleId)?.title || '已删除文章'
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async replyComment(commentId, reply) {
      return enqueueWrite(async () => {
        const comment = data.comments.find((item) => item.id === commentId);
        if (!comment) throw new Error('comment not found');
        comment.reply = cleanText(reply).slice(0, 1000);
        comment.updatedAt = now();
        return comment;
      });
    },

    async deleteComment(commentId) {
      return enqueueWrite(async () => {
        data.comments = data.comments.filter((item) => item.id !== commentId);
        return { ok: true };
      });
    },

    async createMessage(input) {
      return enqueueWrite(async () => {
        const timestamp = now();
        const message = {
          id: id(),
          author: cleanText(input.author, '匿名访客').slice(0, 40),
          content: cleanText(input.content).slice(0, 1000),
          reply: '',
          createdAt: timestamp,
          updatedAt: timestamp
        };
        data.messages.push(message);
        return message;
      });
    },

    async listMessages() {
      return [...data.messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async replyMessage(messageId, reply) {
      return enqueueWrite(async () => {
        const message = data.messages.find((item) => item.id === messageId);
        if (!message) throw new Error('message not found');
        message.reply = cleanText(reply).slice(0, 1000);
        message.updatedAt = now();
        return message;
      });
    },

    async deleteMessage(messageId) {
      return enqueueWrite(async () => {
        data.messages = data.messages.filter((item) => item.id !== messageId);
        return { ok: true };
      });
    },

    async recordVisit(input) {
      return enqueueWrite(async () => {
        const ip = cleanText(input.ip, 'unknown');
        const location = locationForIp(ip);
        const visit = {
          id: id(),
          ip,
          country: cleanText(input.country, location.country),
          province: cleanText(input.province, location.province),
          path: cleanText(input.path, '/'),
          method: cleanText(input.method, 'GET'),
          statusCode: Number(input.statusCode || 0),
          userAgent: cleanText(input.userAgent).slice(0, 300),
          createdAt: now()
        };
        data.visits.push(visit);
        if (data.visits.length > MAX_VISITS) {
          data.visits = data.visits.slice(-MAX_VISITS);
        }
        return visit;
      });
    },

    async getAnalytics() {
      const today = now().slice(0, 10);
      const uniqueIps = new Set(data.visits.map((visit) => visit.ip));
      const countBy = (key) => data.visits.reduce((acc, visit) => {
        const value = key === 'province' ? displayProvince(visit) : (visit[key] || '未知');
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {});
      const requestTrend = Array.from({ length: 7 }, (_item, index) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - (6 - index));
        const key = date.toISOString().slice(0, 10);
        return {
          date: key,
          count: data.visits.filter((visit) => visit.createdAt.startsWith(key)).length
        };
      });
      const topPaths = Object.entries(countBy('path'))
        .map(([pathName, count]) => ({ path: pathName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      const provinceStats = Object.entries(countBy('province'))
        .map(([province, count]) => ({ province, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalRequests: data.visits.length,
        uniqueVisitors: uniqueIps.size,
        todayRequests: data.visits.filter((visit) => visit.createdAt.startsWith(today)).length,
        articleCount: data.articles.length,
        albumCount: data.albums.length,
        photoCount: data.photos.length,
        commentCount: data.comments.length,
        messageCount: data.messages.length,
        requestTrend,
        topPaths,
        provinceStats,
        recentVisits: [...data.visits]
          .reverse()
          .slice(0, 50)
          .map((visit) => ({
            ...visit,
            country: displayCountry(visit),
            province: displayProvince(visit)
          }))
      };
    }
  };

  return api;
}
