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
import { locationForIp, normalizeIp } from './geo.js';
import { createStore } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const COOKIE_NAME = 'pv_admin_session';

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
    status: body.status === 'draft' ? 'draft' : 'published'
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
  await mkdir(uploadDir, { recursive: true });
  const auth = await buildAuth();
  const upload = createUpload(uploadDir);
  const adminOnly = requireAdmin(auth);

  app.set('trust proxy', true);
  app.use(compression());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(visitMiddleware(store, basePath));

  const router = express.Router();

  router.get('/api/public/bootstrap', asyncHandler(async (_req, res) => {
    const [settings, categories, recommendedArticles, latestArticles, albums, messages] = await Promise.all([
      store.getSettings(),
      store.listCategories(),
      store.listArticles({ recommended: true }),
      store.listArticles({}),
      store.listAlbums({ mode: 'folder' }),
      store.listMessages()
    ]);

    res.json({
      settings,
      categories,
      recommendedArticles: recommendedArticles.slice(0, 6),
      latestArticles: latestArticles.slice(0, 8),
      albums: albums.slice(0, 4),
      messages: messages.slice(0, 8)
    });
  }));

  router.get('/api/public/articles', asyncHandler(async (req, res) => {
    const articles = await store.listArticles({
      categorySlug: req.query.category,
      recommended: req.query.recommended,
      search: req.query.search
    });
    res.json({ articles });
  }));

  router.get('/api/public/articles/:identifier', asyncHandler(async (req, res) => {
    const article = await store.getArticle(req.params.identifier);
    if (!article) {
      res.status(404).json({ error: '文章不存在' });
      return;
    }
    const viewed = await store.incrementArticleView(article.id);
    const comments = await store.listComments({ articleId: article.id });
    res.json({ article: viewed || article, comments });
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

  router.get('/api/admin/categories', adminOnly, asyncHandler(async (_req, res) => {
    res.json({ categories: await store.listCategories() });
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
    res.json({ albums: await store.listAlbums({ mode: req.query.mode === 'date' ? 'date' : 'folder' }) });
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
  app.use(`${basePath}/uploads`, express.static(uploadDir, { maxAge: '7d' }));
  app.use(`${basePath}/assets`, express.static(path.join(distDir, 'assets'), { maxAge: '1y', immutable: true }));

  const sendIndex = (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  };

  app.get('/', (_req, res) => res.redirect(`${basePath}/`));
  app.get(basePath, sendIndex);
  app.get(`${basePath}/*`, sendIndex);

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: error.message || '服务器错误' });
  });

  articleReviewer.enqueueMissingReviews().catch((error) => {
    console.error('article AI review backfill failed', error);
  });

  return app;
}

const port = Number(process.env.PORT || 4210);
const app = await createApp();
app.listen(port, '0.0.0.0', () => {
  console.log(`PrinceVlog listening on http://127.0.0.1:${port}${normalizeBasePath(process.env.BASE_PATH)}/`);
});
