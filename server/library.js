import { CONTENT_KINDS, articleYear, isPublic } from './content.js';
import { createAnnualTimeline } from './timeline.js';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';

function tarHeader(name, size) {
  const header = Buffer.alloc(512);
  if (Buffer.byteLength(name) > 100) {
    const split = name.lastIndexOf('/');
    const prefix = name.slice(0, split);
    name = name.slice(split + 1);
    if (
      split < 0 ||
      Buffer.byteLength(prefix) > 155 ||
      Buffer.byteLength(name) > 100
    )
      throw new Error('备份文件名过长');
    header.write(prefix, 345, 155);
  }
  header.write(name, 0, 100);
  for (const [offset, length, value] of [
    [100, 8, 420],
    [108, 8, 0],
    [116, 8, 0],
    [124, 12, size],
    [136, 12, Math.floor(Date.now() / 1000)],
  ]) {
    header.write(
      value.toString(8).padStart(length - 1, '0') + '\0',
      offset,
      length,
    );
  }
  header.fill(32, 148, 156);
  header.write('0', 156);
  header.write('ustar\0', 257);
  header.write('00', 263);
  header.write(
    [...header]
      .reduce((a, b) => a + b, 0)
      .toString(8)
      .padStart(6, '0') + '\0 ',
    148,
    8,
  );
  return header;
}

async function* backupStream(snapshot, uploadDir) {
  const json = Buffer.from(JSON.stringify(snapshot, null, 2));
  yield tarHeader('data.json', json.length);
  yield json;
  yield Buffer.alloc((512 - (json.length % 512)) % 512);
  async function* files(directory, relative = '') {
    for (const file of await readdir(directory, { withFileTypes: true })) {
      if (file.isDirectory())
        yield* files(
          path.join(directory, file.name),
          `${relative}${file.name}/`,
        );
      else if (file.isFile()) yield `${relative}${file.name}`;
    }
  }
  for await (const file of files(uploadDir)) {
    const name = `uploads/${file}`;
    const full = path.join(uploadDir, file);
    const info = await stat(full);
    yield tarHeader(name, info.size);
    for await (const chunk of createReadStream(full)) yield chunk;
    yield Buffer.alloc((512 - (info.size % 512)) % 512);
  }
  yield Buffer.alloc(1024);
}

export function installLibraryRoutes(
  router,
  { store, adminOnly, asyncHandler, uploadDir, summary },
) {
  async function library() {
    const [articles, albums, moments, years, projects, trips] =
      await Promise.all([
        store.listArticles(),
        store.listAlbums(),
        ...CONTENT_KINDS.map((kind) => store.listEntries(kind)),
      ]);
    const timeline = createAnnualTimeline(articles);
    const hiddenYears = new Set(
      (await store.listEntries('years', { includePrivate: true }))
        .filter((entry) => !isPublic(entry))
        .map((entry) => entry.year),
    );
    const yearKeys = [
      ...new Set([
        ...timeline.years.map((y) => String(y.year)),
        ...years.map((y) => y.year),
      ]),
    ]
      .filter((y) => !hiddenYears.has(y))
      .sort()
      .reverse();
    const archives = yearKeys.map((year) => {
      const entry = years.find((y) => y.year === year);
      const group = timeline.years.find((y) => String(y.year) === year);
      const selectedArticles = entry?.articleIds.length
        ? articles.filter((a) => entry.articleIds.includes(a.id))
        : articles.filter((a) => articleYear(a) === year);
      return {
        ...entry,
        year,
        title: entry?.title || `${year} 年度档案`,
        theme: entry?.theme || '沿着时间，回看这一年',
        events: group?.events || [],
        articles: selectedArticles.map(summary),
        photos: albums
          .flatMap((a) => a.photos)
          .filter(
            (p) =>
              entry?.photoIds?.includes(p.id) ||
              entry?.albumIds?.includes(p.albumId),
          ),
        reflection: entry?.reflection || '',
        content: entry?.content || '',
      };
    });
    return {
      moments,
      years: archives,
      projects,
      trips,
      albums,
      articles: articles.map(summary),
      timeline,
      stats: {
        articles: articles.length,
        years: new Set(articles.map(articleYear).filter(Boolean)).size,
        albums: albums.length,
      },
    };
  }
  router.get(
    '/api/public/library',
    asyncHandler(async (_req, res) => res.json(await library())),
  );
  router.get(
    '/api/admin/content/:kind',
    adminOnly,
    asyncHandler(async (req, res) =>
      res.json({
        entries: await store.listEntries(req.params.kind, {
          includePrivate: true,
        }),
      }),
    ),
  );
  router.post(
    '/api/admin/content/:kind',
    adminOnly,
    asyncHandler(async (req, res) =>
      res.status(201).json({
        entry: await store.saveEntry(req.params.kind, null, req.body),
      }),
    ),
  );
  router.put(
    '/api/admin/content/:kind/:id',
    adminOnly,
    asyncHandler(async (req, res) =>
      res.json({
        entry: await store.saveEntry(req.params.kind, req.params.id, req.body),
      }),
    ),
  );
  router.delete(
    '/api/admin/content/:kind/:id',
    adminOnly,
    asyncHandler(async (req, res) =>
      res.json(await store.deleteEntry(req.params.kind, req.params.id)),
    ),
  );
  router.get(
    '/api/admin/articles/:id/revisions',
    adminOnly,
    asyncHandler(async (req, res) =>
      res.json({ revisions: await store.getRevisions(req.params.id) }),
    ),
  );
  router.get(
    '/api/admin/drafts/:key',
    adminOnly,
    asyncHandler(async (req, res) =>
      res.json({ draft: await store.getDraft(req.params.key) }),
    ),
  );
  router.put(
    '/api/admin/drafts/:key',
    adminOnly,
    asyncHandler(async (req, res) =>
      res.json({
        draft: await store.saveDraft(req.params.key, req.body.form ?? null),
      }),
    ),
  );
  router.get(
    '/api/admin/backup',
    adminOnly,
    asyncHandler(async (_req, res) => {
      const snapshot = await store.exportData();
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="princevlog-${new Date().toISOString().slice(0, 10)}.tar.gz"`,
      );
      res.setHeader('Cache-Control', 'no-store');
      await pipeline(
        Readable.from(backupStream(snapshot, uploadDir)),
        createGzip(),
        res,
      );
    }),
  );
}
