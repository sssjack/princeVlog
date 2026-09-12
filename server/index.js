import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createAdminAuth, hashPassword } from './auth.js';
import { createArticleReviewQueue } from './aiReview.js';
import { loadEnvFile } from './env.js';
import { locationForIp, normalizeIp } from './geo.js';
import { answerProfileQuestion } from './profileChat.js';
import { createStore } from './store.js';
import { installLibraryRoutes } from './library.js';
import { articleYear } from './content.js';
import { createAnnualTimeline } from './timeline.js';
import { createAnnualTimelineInsightQueue, needsAnnualTimelineInsight } from './timelineInsight.js';
import { createTimelineTitleQueue, needsTimelineEventTitles } from './timelineTitles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const COOKIE_NAME = 'pv_admin_session';

loadEnvFile(path.join(projectRoot, '.env'));

function normalizeBasePath(input) {
  const value = String(input || '/princevlog').trim();
  if (!value || value === '/') return '';
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function text(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function toBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function publicArticleSummary(article) {
  return {
    id: article.id,
    year: articleYear(article),
    readingMinutes: Math.max(1, Math.ceil(String(article.content || "").length / 450)),
    title: article.title,
    subtitle: article.subtitle,
    slug: article.slug,
    coverUrl: article.coverUrl,
    categoryId: article.categoryId,
    categoryName: article.categoryName,
    categorySlug: article.categorySlug,
    excerpt: article.excerpt,
    recommended: article.recommended,
    status: article.status,
    viewCount: article.viewCount,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt
  };
}

async function buildAuth() {
  const passwordHash = process.env.ADMIN_PASSWORD_HASH
    || await hashPassword(process.env.ADMIN_PASSWORD || 'change-me-dev-password', process.env.ADMIN_PASSWORD_SALT || 'princevlog-admin');

  return createAdminAuth({
    adminUser: process.env.ADMIN_USER || 'root',
    passwordHash,
    sessionSecret: process.env.SESSION_SECRET || 'princevlog-session-secret'
  });
}

function createUpload(uploadDir) {
  const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    }
  });

  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      cb(null, /^image\//.test(file.mimetype));
    }
  });
}

function requireAdmin(auth) {
  return (req, res, next) => {
    const session = auth.verifySession(req.cookies?.[COOKIE_NAME]);
    if (!session) {
      res.status(401).json({ error: '请先登录后台' });
      return;
    }
    req.admin = session;
    next();
  };
}

function visitMiddleware(store, basePath) {
  return (req, res, next) => {
    const startedPath = req.originalUrl || req.url;
    const shouldRecord = startedPath.startsWith(basePath)
      && !startedPath.includes('/assets/')
      && !startedPath.includes('/uploads/')
      && !startedPath.includes('/api/admin/analytics');

    res.on('finish', () => {
      if (!shouldRecord) return;
      const ip = normalizeIp(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress);
      const location = locationForIp(ip);
      store.recordVisit({
        ip,
        country: location.country,
        province: location.province,
        path: startedPath.split('?')[0],
        method: req.method,
        statusCode: res.statusCode,
        userAgent: req.headers['user-agent'] || ''
      }).catch((error) => {
        console.error('visit record failed', error);
      });
    });

    next();
  };
}

function createPublicRateLimit({ windowMs = 60_000, max = 8 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const key = normalizeIp(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress) || 'anonymous';
    const timestamp = Date.now();
    const bucket = (buckets.get(key) || []).filter((item) => timestamp - item < windowMs);
    if (bucket.length >= max) {
      res.status(429).json({ error: '提问太快了，稍等一下再继续。' });
      return;
    }
    bucket.push(timestamp);
    buckets.set(key, bucket);
    next();
  };
}

function articlePayload(body) {
  return {
    title: text(body.title),
    subtitle: text(body.subtitle),
    slug: text(body.slug),
    coverUrl: text(body.coverUrl),
    categoryId: text(body.categoryId),
    content: String(body.content || ''),
    excerpt: text(body.excerpt),
    recommended: toBool(body.recommended),
    visibility: body.visibility,
    year: body.year,
    status: body.status === 'draft' ? 'draft' : 'published'
  };
}

function backgroundPhotoPayload(body) {
  return {
    title: text(body.title),
    imageUrl: text(body.imageUrl),
    position: Number(body.position || 0)
  };
}

export async function createApp() {
  const app = express();
  const basePath = normalizeBasePath(process.env.BASE_PATH);
  const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
  const uploadDir = process.env.UPLOAD_DIR || path.join(dataDir, 'uploads');
  const distDir = path.join(projectRoot, 'dist');
  const store = createStore(process.env.DB_PATH || path.join(dataDir, 'data.json'), { seedDemo: true });
  await store.init();
  const articleReviewer = createArticleReviewQueue({ store });
  const annualTimelineInsightQueue = createAnnualTimelineInsightQueue({ store });
  const timelineTitleQueue = createTimelineTitleQueue({ store });
  await mkdir(uploadDir, { recursive: true });
  const auth = await buildAuth();
  const upload = createUpload(uploadDir);
  const adminOnly = requireAdmin(auth);
  const publicAiLimit = createPublicRateLimit({ max: 8 });

  app.set('trust proxy', true);
  app.use(compression());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(visitMiddleware(store, basePath));

  const router = express.Router();
  router.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  installLibraryRoutes(router, { store, adminOnly, asyncHandler, uploadDir, summary: publicArticleSummary });

  router.get('/api/public/bootstrap', asyncHandler(async (_req, res) => {
    const [settings, categories, recommendedArticles, latestArticles, albums, messages, backgroundPhotos] = await Promise.all([
      store.getSettings(),
      store.listCategories(),
      store.listArticles({ recommended: true }),
      store.listArticles({}),
      store.listAlbums({ mode: 'folder' }),
      store.listMessages(),
      store.listBackgroundPhotos()
    ]);

    res.json({
      settings,
      categories: categories.filter(category => latestArticles.some(article => article.categoryId === category.id)),
      recommendedArticles: recommendedArticles.slice(0, 6).map(publicArticleSummary),
      latestArticles: latestArticles.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8).map(publicArticleSummary),
      albums: albums.slice(0, 4),
      messages: messages.slice(0, 8),
      backgroundPhotos
    });
  }));

  router.get('/api/public/background-photos', asyncHandler(async (_req, res) => {
    res.json({ backgroundPhotos: await store.listBackgroundPhotos() });
  }));

  router.get('/api/public/timeline', asyncHandler(async (_req, res) => {
    const articles = await store.listArticles({});
    const insight = await store.getAnnualTimelineInsight();
    const timelineTitles = await store.getTimelineEventTitles();
    if (needsAnnualTimelineInsight(articles, insight)) {
      annualTimelineInsightQueue.enqueueInsight();
    }
    if (needsTimelineEventTitles(articles, timelineTitles)) {
      timelineTitleQueue.enqueueTitles();
    }
    res.json({
      timeline: createAnnualTimeline(articles, { titleOverrides: needsTimelineEventTitles(articles, timelineTitles) ? {} : timelineTitles.titles }),
      insight: needsAnnualTimelineInsight(articles, insight) ? { status: 'pending' } : insight,
      timelineTitles: {
        status: timelineTitles.status,
        updatedAt: timelineTitles.updatedAt
      }
    });
  }));

  router.get('/api/public/articles', asyncHandler(async (req, res) => {
    const articles = await store.listArticles({
      categorySlug: req.query.category,
      recommended: req.query.recommended,
      search: req.query.search,
      year: req.query.year
    });
    const allArticles = await store.listArticles();
    res.json({ articles: articles.map(publicArticleSummary), years: [...new Set(allArticles.map(articleYear))].filter(Boolean).sort().reverse(), categories: (await store.listCategories()).filter(category => allArticles.some(article => article.categoryId === category.id)) });
  }));

  router.get('/api/public/articles/:identifier', asyncHandler(async (req, res) => {
    const article = await store.getArticle(req.params.identifier);
    if (!article) {
      res.status(404).json({ error: '文章不存在' });
      return;
    }
    const viewed = await store.incrementArticleView(article.id);
    const comments = await store.listComments({ articleId: article.id });
    const articles = await store.listArticles();
    const index = articles.findIndex(a => a.id === article.id);
    const trips = (await store.listEntries('trips')).filter(t => t.articleIds.includes(article.id));
    res.json({ article: viewed || article, comments, trips,
      previous: index > 0 ? publicArticleSummary(articles[index - 1]) : null,
      next: index < articles.length - 1 ? publicArticleSummary(articles[index + 1]) : null });
  }));

  router.post('/api/public/articles/:identifier/comments', asyncHandler(async (req, res) => {
    const article = await store.getArticle(req.params.identifier);
    if (!article) {
      res.status(404).json({ error: '文章不存在' });
      return;
    }
    if (!text(req.body.content)) {
      res.status(400).json({ error: '评论内容不能为空' });
      return;
    }
    const comment = await store.createComment({
      articleId: article.id,
      author: req.body.author,
      content: req.body.content
    });
    res.status(201).json({ comment });
  }));

  router.post('/api/public/profile-chat', publicAiLimit, asyncHandler(async (req, res) => {
    const question = text(req.body.question).slice(0, 500);
    if (!question) {
      res.status(400).json({ error: '问题不能为空' });
      return;
    }
    const articles = await store.listArticles({});
    const result = await answerProfileQuestion(question, articles);
    res.json(result);
  }));

  router.get('/api/public/albums', asyncHandler(async (req, res) => {
    const albums = await store.listAlbums({ mode: req.query.mode === 'date' ? 'date' : 'folder' });
    res.json({ albums });
  }));

  router.get('/api/public/messages', asyncHandler(async (_req, res) => {
    res.json({ messages: await store.listMessages() });
  }));

  router.post('/api/public/messages', asyncHandler(async (req, res) => {
    if (!text(req.body.content)) {
      res.status(400).json({ error: '留言内容不能为空' });
      return;
    }
    const message = await store.createMessage({ author: req.body.author, content: req.body.content });
    res.status(201).json({ message });
  }));

  router.post('/api/admin/login', asyncHandler(async (req, res) => {
    const result = await auth.login(text(req.body.username), String(req.body.password || ''));
    if (!result.ok) {
      res.status(401).json({ error: result.message });
      return;
    }
    res.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 1000 * 60 * 60 * 12,
      path: basePath || '/'
    });
    res.json({ user: { username: result.username } });
  }));

  router.post('/api/admin/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: basePath || '/' });
    res.json({ ok: true });
  });

  router.get('/api/admin/me', adminOnly, (req, res) => {
    res.json({ user: { username: req.admin.username } });
  });

  router.get('/api/admin/settings', adminOnly, asyncHandler(async (_req, res) => {
    res.json({ settings: await store.getSettings() });
  }));

  router.put('/api/admin/settings', adminOnly, asyncHandler(async (req, res) => {
    const settings = await store.updateSettings(req.body);
    res.json({ settings });
  }));

  router.get('/api/admin/background-photos', adminOnly, asyncHandler(async (_req, res) => {
    res.json({ backgroundPhotos: await store.listBackgroundPhotos() });
  }));

  router.post('/api/admin/background-photos', adminOnly, asyncHandler(async (req, res) => {
    res.status(201).json({ backgroundPhoto: await store.createBackgroundPhoto(backgroundPhotoPayload(req.body)) });
  }));

  router.put('/api/admin/background-photos/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json({ backgroundPhoto: await store.updateBackgroundPhoto(req.params.id, backgroundPhotoPayload(req.body)) });
  }));

  router.delete('/api/admin/background-photos/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json(await store.deleteBackgroundPhoto(req.params.id));
  }));

  router.get('/api/admin/categories', adminOnly, asyncHandler(async (_req, res) => {
    res.json({ categories: (await store.listCategories()).filter(category => allArticles.some(article => article.categoryId === category.id)) });
  }));

  router.post('/api/admin/categories', adminOnly, asyncHandler(async (req, res) => {
    res.status(201).json({ category: await store.createCategory(req.body) });
  }));

  router.put('/api/admin/categories/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json({ category: await store.updateCategory(req.params.id, req.body) });
  }));

  router.delete('/api/admin/categories/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json(await store.deleteCategory(req.params.id));
  }));

  router.get('/api/admin/articles', adminOnly, asyncHandler(async (req, res) => {
    res.json({ articles: await store.listArticles({ includeDrafts: true, search: req.query.search }) });
  }));

  router.post('/api/admin/articles', adminOnly, asyncHandler(async (req, res) => {
    const article = await store.createArticle(articlePayload(req.body));
    articleReviewer.enqueueArticle(article);
    res.status(201).json({ article });
  }));

  router.put('/api/admin/articles/:id', adminOnly, asyncHandler(async (req, res) => {
    const article = await store.updateArticle(req.params.id, articlePayload(req.body));
    articleReviewer.enqueueArticle(article);
    res.json({ article });
  }));

  router.post('/api/admin/articles/ai-reviews/backfill', adminOnly, asyncHandler(async (_req, res) => {
    res.json(await articleReviewer.enqueueMissingReviews());
  }));

  router.delete('/api/admin/articles/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json(await store.deleteArticle(req.params.id));
  }));

  router.get('/api/admin/albums', adminOnly, asyncHandler(async (req, res) => {
    res.json({ albums: await store.listAlbums({ mode: req.query.mode === 'date' ? 'date' : 'folder', includePrivate: true }) });
  }));

  router.post('/api/admin/albums', adminOnly, asyncHandler(async (req, res) => {
    res.status(201).json({ album: await store.createAlbum(req.body) });
  }));

  router.put('/api/admin/albums/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json({ album: await store.updateAlbum(req.params.id, req.body) });
  }));

  router.delete('/api/admin/albums/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json(await store.deleteAlbum(req.params.id));
  }));

  router.post('/api/admin/photos', adminOnly, asyncHandler(async (req, res) => {
    res.status(201).json({ photo: await store.createPhoto(req.body) });
  }));

  router.put('/api/admin/photos/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json({ photo: await store.updatePhoto(req.params.id, req.body) });
  }));

  router.delete('/api/admin/photos/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json(await store.deletePhoto(req.params.id));
  }));

  router.get('/api/admin/comments', adminOnly, asyncHandler(async (_req, res) => {
    res.json({ comments: await store.listComments() });
  }));

  router.put('/api/admin/comments/:id/reply', adminOnly, asyncHandler(async (req, res) => {
    res.json({ comment: await store.replyComment(req.params.id, req.body.reply) });
  }));

  router.delete('/api/admin/comments/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json(await store.deleteComment(req.params.id));
  }));

  router.get('/api/admin/messages', adminOnly, asyncHandler(async (_req, res) => {
    res.json({ messages: await store.listMessages() });
  }));

  router.put('/api/admin/messages/:id/reply', adminOnly, asyncHandler(async (req, res) => {
    res.json({ message: await store.replyMessage(req.params.id, req.body.reply) });
  }));

  router.delete('/api/admin/messages/:id', adminOnly, asyncHandler(async (req, res) => {
    res.json(await store.deleteMessage(req.params.id));
  }));

  router.get('/api/admin/analytics', adminOnly, asyncHandler(async (_req, res) => {
    res.json({ analytics: await store.getAnalytics() });
  }));

  router.post('/api/admin/uploads', adminOnly, upload.single('file'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: '请选择图片文件' });
      return;
    }
    res.status(201).json({ url: `${basePath}/uploads/${req.file.filename}` });
  });

  app.use(basePath, router);
  app.use(`${basePath}/uploads`, asyncHandler(async (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const filename = decodeURIComponent(req.path).replace(/^\//, '');
    if (!auth.verifySession(req.cookies?.[COOKIE_NAME]) && !await store.isPublicUpload(filename)) {
      return res.status(404).end();
    }
    next();
  }), express.static(uploadDir, { cacheControl: false }));
  app.use(`${basePath}/assets`, express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));

  const sendIndex = (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  };

  app.get('/', (_req, res) => res.redirect(`${basePath}/`));
  app.get(basePath, sendIndex);
  app.get(`${basePath}/*`, sendIndex);

  app.use((error, _req, res, _next) => {
    console.error(error);
    if (res.headersSent) return res.destroy();
    res.status(500).json({ error: error.message || '服务器错误' });
  });

  articleReviewer.enqueueMissingReviews().catch((error) => {
    console.error('article AI review backfill failed', error);
  });
  annualTimelineInsightQueue.enqueueInsight();
  timelineTitleQueue.enqueueTitles();

  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4210);
  const app = await createApp();
  app.listen(port, '0.0.0.0', () => console.log(`PrinceVlog listening on port ${port}`));
}
