import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  X,
  Search,
  Camera,
  Plus,
  Save,
  Download,
  Clock3,
} from 'lucide-react';
import './features.css';

const BASE = (import.meta.env.BASE_URL || '/princevlog/').replace(/\/$/, '');
export async function request(endpoint, options = {}) {
  const form = options.body instanceof FormData;
  const response = await fetch(`${BASE}/api${endpoint}`, {
    credentials: 'include',
    ...options,
    headers: form ? {} : { 'Content-Type': 'application/json' },
    body: options.body
      ? form
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '请求失败，请重试');
  return result;
}
function useLoad(endpoint) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    request(endpoint)
      .then((data) => alive && setState({ data }))
      .catch((e) => alive && setState({ error: e.message }));
    return () => {
      alive = false;
    };
  }, [endpoint]);
  return state;
}
function Status({ state }) {
  return state.loading ? (
    <p role="status" className="feature-status">
      正在整理记录…
    </p>
  ) : state.error ? (
    <p role="alert" className="feature-status">
      {state.error}
    </p>
  ) : null;
}
export function SiteLink({ to, children, className = '' }) {
  return (
    <a className={className} href={`${BASE}${to}`}>
      {children}
    </a>
  );
}
const date = (value) => (value ? String(value).slice(0, 10) : '');
function SectionTitle({ title, description, to, linkText = '查看全部' }) {
  return (
    <div className="feature-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {to && (
        <SiteLink to={to}>
          {linkText} <ArrowRight size={16} />
        </SiteLink>
      )}
    </div>
  );
}

export function Cover({ article, detail = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [article.coverUrl]);
  const annual = /年终|年度|这一年|year-review/.test(
    `${article.title} ${article.slug}`,
  );
  const technical = /技术|编程|开发|Java/i.test(article.categoryName || '');
  if (article.coverUrl && !failed && !annual && !technical)
    return (
      <img
        className="story-cover"
        src={article.coverUrl}
        alt={article.title}
        loading={detail ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  return (
    <div
      className={`type-cover ${annual ? 'annual' : 'textual'}`}
      aria-hidden="true"
    >
      <span>{annual ? '年度手记' : article.categoryName || '生活与思考'}</span>
      <strong>
        {annual
          ? article.year || article.title.match(/20\d{2}/)?.[0]
          : article.title}
      </strong>
      <small>PRINCE · {annual ? 'A YEAR IN LIFE' : 'NOTES & IDEAS'}</small>
    </div>
  );
}
export function StoryCard({ article }) {
  return (
    <article className="story-card">
      <SiteLink to={`/article/${article.slug}`}>
        <Cover article={article} />
        <div>
          <small>
            {article.categoryName} · {article.year}
          </small>
          <h3>{article.title}</h3>
          <p>{article.excerpt || article.subtitle}</p>
          <span>{article.readingMinutes || 1} 分钟阅读</span>
        </div>
      </SiteLink>
    </article>
  );
}

export function HomeExperience({ children }) {
  const state = useLoad('/public/library');
  const bootstrap = useLoad('/public/bootstrap');
  if (!state.data || !bootstrap.data)
    return (
      <Status
        state={
          state.error
            ? state
            : bootstrap.error
              ? bootstrap
              : state.loading
                ? state
                : bootstrap
        }
      />
    );
  const { moments, years, albums, stats } = state.data;
  const { settings, recommendedArticles, latestArticles } = bootstrap.data;
  const latest = moments[0];
  return (
    <div className="home feature-home">
      <section className="feature-hero feature-width">
        <div>
          <span className="feature-eyebrow">PRINCE / 生活手记</span>
          <h1>写代码，也记录生活。</h1>
          <p>
            我是 Prince。从年度总结到沿途风景，
            <br />
            把经历慢慢存下来。
          </p>
          <div className="feature-actions">
            <SiteLink className="solid-link" to="/articles">
              开始阅读 <ArrowRight size={17} />
            </SiteLink>
            <SiteLink to="/about">认识一下我</SiteLink>
          </div>
          <p className="real-stats">
            {stats.years} 年记录 · {stats.articles} 篇文章 · {stats.albums}{' '}
            本相册
          </p>
        </div>
        <aside className="now-note">
          <span>{latest ? '此刻' : '一句话'}</span>
          <p>
            {latest?.content ||
              settings.mottoes?.[0] ||
              '把时间花在热爱的事情上。'}
          </p>
          {latest?.imageUrl && (
            <img src={latest.imageUrl} alt="最新短记配图" loading="lazy" />
          )}
          <div>
            {latest ? (
              <time>{latest.date}</time>
            ) : (
              <small>{settings.ownerName || 'Prince'}</small>
            )}
            <SiteLink to="/moments">
              所有短记 <ArrowRight size={14} />
            </SiteLink>
          </div>
        </aside>
      </section>
      <section className="feature-width feature-section">
        <SectionTitle
          title="精选故事"
          description="第一次来，可以从这里读起。"
          to="/articles"
        />
        <div className="story-grid">
          {(recommendedArticles.length ? recommendedArticles : latestArticles)
            .slice(0, 3)
            .map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
        </div>
        {!latestArticles.length && <p>故事正在整理中。</p>}
      </section>
      <section className="feature-width feature-section">
        <SectionTitle
          title="最近更新"
          description="日子继续往前，记录也在慢慢生长。"
          to="/articles"
        />
        <div className="recent-stories">
          {latestArticles
            .slice()
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 4)
            .map((a) => (
              <SiteLink key={a.id} to={`/article/${a.slug}`}>
                <time>{date(a.updatedAt)}</time>
                <strong>{a.title}</strong>
                <span>
                  {a.categoryName}
                  <ArrowRight size={16} />
                </span>
              </SiteLink>
            ))}
        </div>
      </section>
      <section className="feature-width feature-section">
        <SectionTitle
          title="一年，一页"
          description="当时怎么想，今天怎么看。"
          to="/years"
        />
        <div className="year-previews">
          {years.slice(0, 3).map((y) => (
            <SiteLink key={y.year} to={`/year/${y.year}`}>
              <strong>{y.year}</strong>
              <p>{y.theme}</p>
              <span>
                {y.events.length} 个时间节点 <ArrowRight size={16} />
              </span>
            </SiteLink>
          ))}
        </div>
        <SiteLink className="quiet-link" to="/timeline">
          查看完整时间轴与年度复盘
        </SiteLink>
      </section>
      <section className="feature-width feature-section">
        <SectionTitle title="沿途风景" to="/gallery" />
        <div className="album-covers">
          {albums.slice(0, 3).map((album) => (
            <SiteLink
              key={album.id}
              to={`/gallery?album=${encodeURIComponent(album.id)}`}
            >
              <img
                src={album.coverUrl || album.photos[0]?.imageUrl}
                alt={album.title}
                loading="lazy"
              />
              <h3>{album.title}</h3>
              <span>{album.photos.length} 张照片</span>
            </SiteLink>
          ))}
        </div>
        <SiteLink className="quiet-link" to="/trips">
          把照片串成旅行故事
        </SiteLink>
      </section>
      <div className="feature-width home-extras">{children}</div>
    </div>
  );
}

export function SearchArticles() {
  const initial = new URLSearchParams(window.location.search);
  const [filters, setFilters] = useState({
    search: initial.get('search') || '',
    year: initial.get('year') || '',
    category: initial.get('category') || '',
  });
  const [query, setQuery] = useState(initial.toString());
  const state = useLoad(`/public/articles?${query}`);
  function apply(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const next = params.toString();
    setQuery(next);
    window.history.replaceState(
      {},
      '',
      `${BASE}/articles${next ? `?${next}` : ''}`,
    );
  }
  function clear() {
    setFilters({ search: '', year: '', category: '' });
    setQuery('');
    window.history.replaceState({}, '', `${BASE}/articles`);
  }
  return (
    <section className="page-shell">
      <div className="page-title">
        <span>READ & REMEMBER</span>
        <h1>文字档案</h1>
        <p>用一个词、一年时光，找回当时的故事。</p>
      </div>
      <form className="article-filters" onSubmit={apply}>
        <label className="search-field">
          关键词
          <input
            type="search"
            placeholder="搜索标题、摘要和正文"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </label>
        <label>
          年份
          <select
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
          >
            <option value="">全部年份</option>
            {state.data?.years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          分类
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
          >
            <option value="">全部分类</option>
            {state.data?.categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className="solid-link" type="submit">
          <Search size={17} />
          查找
        </button>
        <button type="button" onClick={clear}>
          重置
        </button>
      </form>
      <Status state={state} />
      {state.data && (
        <>
          <p aria-live="polite">找到 {state.data.articles.length} 篇文章</p>
          <div className="story-grid">
            {state.data.articles.map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
          </div>
          {!state.data.articles.length && (
            <p className="feature-status">没有匹配的文章，试试减少筛选条件。</p>
          )}
        </>
      )}
    </section>
  );
}

export function Lightbox({ photos, index, onClose, onIndex }) {
  const dialog = useRef(null);
  const touch = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const photo = photos[index];
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const move = (amount) =>
    onIndex((index + amount + photos.length) % photos.length);
  return (
    <dialog
      ref={dialog}
      className="photo-dialog"
      aria-label="照片大图浏览"
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          move(-1);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          move(1);
        }
      }}
    >
      <button
        className="lightbox-close"
        onClick={onClose}
        aria-label="关闭大图"
      >
        <X />
      </button>
      <figure
        onTouchStart={(e) => {
          touch.current = [e.touches[0].clientX, e.touches[0].clientY];
        }}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current[0];
          const dy = e.changedTouches[0].clientY - touch.current[1];
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy))
            move(dx > 0 ? -1 : 1);
          touch.current = null;
        }}
      >
        <img src={photo.imageUrl} alt={photo.title || '生活照片'} />
        <figcaption>
          <strong>{photo.title}</strong>
          <p>{photo.caption}</p>
          <span>
            {photo.shotAt} · {index + 1} / {photos.length}
          </span>
        </figcaption>
      </figure>
      {photos.length > 1 && (
        <div className="lightbox-controls">
          <button onClick={() => move(-1)} aria-label="上一张">
            <ArrowLeft />
          </button>
          <button onClick={() => move(1)} aria-label="下一张">
            <ArrowRight />
          </button>
        </div>
      )}
    </dialog>
  );
}
export function PhotoGrid({ photos }) {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <div className="feature-photo-grid">
        {photos.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setSelected(i)}
            aria-label={`查看大图：${p.title}`}
          >
            <img
              src={p.imageUrl}
              alt={p.title}
              loading="lazy"
              decoding="async"
            />
            <span>{p.title}</span>
          </button>
        ))}
      </div>
      {selected !== null && photos[selected] && (
        <Lightbox
          photos={photos}
          index={selected}
          onIndex={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
export function GalleryExperience() {
  const state = useLoad('/public/library');
  const albumId = new URLSearchParams(window.location.search).get('album');
  const [mode, setMode] = useState('folder');
  if (!state.data) return <Status state={state} />;
  const { albums, trips } = state.data;
  const selected = albums.find((a) => a.id === albumId);
  if (albumId && !selected)
    return (
      <section className="page-shell">
        <h1>相册不存在或未公开</h1>
        <SiteLink to="/gallery">返回全部相册</SiteLink>
      </section>
    );
  const photos = selected?.photos || albums.flatMap((a) => a.photos);
  const groups = Object.groupBy
    ? Object.groupBy(photos, (p) => p.shotAt)
    : photos.reduce((out, p) => {
        (out[p.shotAt] ||= []).push(p);
        return out;
      }, {});
  return (
    <section className="page-shell">
      <div className="page-title">
        <span>ALONG THE WAY</span>
        <h1>{selected?.title || '生活相册'}</h1>
        <p>{selected?.description || '点击一本相册，走进一段回忆。'}</p>
      </div>
      {selected ? (
        <>
          <SiteLink to="/gallery">← 全部相册</SiteLink>
          <PhotoGrid photos={photos} />
          {!photos.length && <p>这个相册暂时没有照片。</p>}
          <TripLinks
            trips={trips.filter((t) => t.albumIds.includes(selected.id))}
          />
        </>
      ) : (
        <>
          <div className="segmented">
            <button
              aria-pressed={mode === 'folder'}
              className={mode === 'folder' ? 'active' : ''}
              onClick={() => setMode('folder')}
            >
              按相册
            </button>
            <button
              aria-pressed={mode === 'date'}
              className={mode === 'date' ? 'active' : ''}
              onClick={() => setMode('date')}
            >
              按日期
            </button>
          </div>
          {mode === 'folder' ? (
            <div className="album-covers">
              {albums.map((a) => (
                <SiteLink
                  key={a.id}
                  to={`/gallery?album=${encodeURIComponent(a.id)}`}
                >
                  <img
                    src={a.coverUrl || a.photos[0]?.imageUrl}
                    alt={a.title}
                    loading="lazy"
                  />
                  <h2>{a.title}</h2>
                  <p>{a.description}</p>
                  <small>{a.photos.length} 张照片</small>
                </SiteLink>
              ))}
            </div>
          ) : (
            Object.keys(groups)
              .sort()
              .reverse()
              .map((day) => (
                <section key={day} className="feature-section">
                  <h2>{day}</h2>
                  <PhotoGrid photos={groups[day]} />
                </section>
              ))
          )}
          {!albums.length && <p>相册正在整理中。</p>}
        </>
      )}
    </section>
  );
}
export function TripLinks({ trips = [] }) {
  return trips.length ? (
    <aside className="related-block">
      <h3>相关旅行故事</h3>
      {trips.map((t) => (
        <SiteLink key={t.id} to={`/trip/${t.id}`}>
          {t.title}
          <ArrowRight size={16} />
        </SiteLink>
      ))}
    </aside>
  ) : null;
}

export function LibraryPage({ path, Markdown }) {
  const state = useLoad('/public/library');
  const [month, setMonth] = useState('');
  if (!state.data) return <Status state={state} />;
  const data = state.data;
  if (path === '/moments') {
    const months = [...new Set(data.moments.map((m) => m.date.slice(0, 7)))]
      .sort()
      .reverse();
    return (
      <section className="page-shell moments-page">
        <div className="page-title">
          <span>NOW & THEN</span>
          <h1>此刻</h1>
          <p>一句话、一张照片，也是值得留下的一天。</p>
        </div>
        <label className="month-filter">
          按月份查看
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">所有月份</option>
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        {(month ? [month] : months).map((m) => (
          <section key={m} className="month-group">
            <h2>{m}</h2>
            {data.moments
              .filter((entry) => entry.date.startsWith(m))
              .map((entry) => (
                <article className="moment-card" key={entry.id}>
                  <time>{entry.date}</time>
                  <p>{entry.content}</p>
                  {entry.imageUrl && (
                    <PhotoGrid
                      photos={[
                        {
                          id: entry.id,
                          imageUrl: entry.imageUrl,
                          title: entry.title || '此刻',
                          caption: entry.content,
                          shotAt: entry.date,
                        },
                      ]}
                    />
                  )}
                </article>
              ))}
          </section>
        ))}
        {!months.length && (
          <p className="feature-status">第一条短记，留给下一个想记录的瞬间。</p>
        )}
      </section>
    );
  }
  if (path === '/years')
    return (
      <section className="page-shell">
        <div className="page-title">
          <span>YEARBOOK</span>
          <h1>年度档案</h1>
          <p>留住当时的自己，也写下今天的新理解。</p>
        </div>
        <SiteLink to="/timeline">完整时间轴与 AI 复盘 →</SiteLink>
        <div className="year-previews">
          {data.years.map((y) => (
            <SiteLink key={y.year} to={`/year/${y.year}`}>
              <strong>{y.year}</strong>
              <p>{y.theme}</p>
              <span>
                {y.articles.length} 篇记录 · {y.events.length} 个节点
              </span>
            </SiteLink>
          ))}
        </div>
        {!data.years.length && <p>年度档案正在整理中。</p>}
      </section>
    );
  if (path.startsWith('/year/')) {
    const year = data.years.find((y) => y.year === path.split('/').pop());
    if (!year)
      return (
        <section className="page-shell">
          <h1>年度档案不存在或未公开</h1>
          <SiteLink to="/years">返回年度档案</SiteLink>
        </section>
      );
    return (
      <section className="page-shell year-detail">
        <SiteLink to="/years">← 年度档案</SiteLink>
        <div className="year-title">
          <span>{year.year}</span>
          <h1>{year.title}</h1>
          <p>{year.theme}</p>
        </div>
        {year.content && (
          <section>
            <h2>这一年的重要经历</h2>
            <Markdown content={year.content} />
          </section>
        )}
        <div className="year-events">
          {year.events.slice(0, 8).map((e) => (
            <SiteLink key={e.id} to={`/article/${e.articleSlug}`}>
              <time>{e.dateLabel}</time>
              <h3>{e.title}</h3>
              <p>{e.detail}</p>
            </SiteLink>
          ))}
        </div>
        <section className="feature-section">
          <h2>当时的记录</h2>
          <div className="story-grid">
            {year.articles.map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
          </div>
        </section>
        {year.photos.length > 0 && (
          <section className="feature-section">
            <h2>年度精选影像</h2>
            <PhotoGrid photos={year.photos} />
          </section>
        )}
        <section className="reflection-note">
          <h2>今天回看</h2>
          {year.reflection ? (
            <Markdown content={year.reflection} />
          ) : (
            <p>当时的记录已经留下，新的理解，等我慢慢补上。</p>
          )}
        </section>
      </section>
    );
  }
  if (path === '/projects')
    return (
      <section className="page-shell">
        <div className="page-title">
          <span>MADE BY PRINCE</span>
          <h1>作品与折腾</h1>
          <p>把好奇变成动手，把想法变成作品。</p>
        </div>
        <ProjectCards projects={data.projects} />
      </section>
    );
  if (path === '/trips')
    return (
      <section className="page-shell">
        <div className="page-title">
          <span>TRAVEL STORIES</span>
          <h1>旅行故事</h1>
          <p>把游记、相册和沿途的瞬间放在一起。</p>
        </div>
        <div className="story-grid">
          {data.trips.map((t) => (
            <article className="story-card" key={t.id}>
              <SiteLink to={`/trip/${t.id}`}>
                {t.imageUrl && (
                  <img src={t.imageUrl} alt={t.title} loading="lazy" />
                )}
                <div>
                  <small>
                    {t.date} · {t.place}
                  </small>
                  <h2>{t.title}</h2>
                  <p>{t.content.slice(0, 120)}</p>
                </div>
              </SiteLink>
            </article>
          ))}
        </div>
        {!data.trips.length && (
          <p className="feature-status">旅行故事正在整理中。</p>
        )}
      </section>
    );
  const trip = data.trips.find((t) => t.id === path.split('/').pop());
  if (!trip)
    return (
      <section className="page-shell">
        <h1>故事不存在或未公开</h1>
        <SiteLink to="/trips">返回旅行故事</SiteLink>
      </section>
    );
  return (
    <section className="page-shell">
      <SiteLink to="/trips">← 旅行故事</SiteLink>
      <div className="page-title">
        <h1>{trip.title}</h1>
        <p>
          {trip.date} · {trip.place}
        </p>
      </div>
      <Markdown content={trip.content} />
      <section className="feature-section">
        <h2>读游记</h2>
        <div className="story-grid">
          {data.articles
            .filter((a) => trip.articleIds.includes(a.id))
            .map((a) => (
              <StoryCard key={a.id} article={a} />
            ))}
        </div>
      </section>
      <section>
        <h2>看照片</h2>
        {data.albums
          .filter((a) => trip.albumIds.includes(a.id))
          .map((a) => (
            <section className="feature-section" key={a.id}>
              <SiteLink to={`/gallery?album=${a.id}`}>
                <h3>{a.title} →</h3>
              </SiteLink>
              <PhotoGrid photos={a.photos.slice(0, 6)} />
            </section>
          ))}
      </section>
      <section className="year-events">
        {data.timeline.years
          .flatMap((y) => y.events)
          .filter((e) =>
            data.articles.some(
              (a) => a.slug === e.articleSlug && trip.articleIds.includes(a.id),
            ),
          )
          .map((e) => (
            <SiteLink key={e.id} to={`/article/${e.articleSlug}`}>
              {e.dateLabel} · {e.title}
            </SiteLink>
          ))}
      </section>
    </section>
  );
}
function ProjectCards({ projects }) {
  return (
    <div className="project-grid">
      {projects.map((p) => (
        <article className="project-card" key={p.id}>
          {p.imageUrl && <img src={p.imageUrl} alt={p.title} loading="lazy" />}
          <h2>{p.title}</h2>
          <dl>
            <dt>为什么做</dt>
            <dd>{p.purpose}</dd>
            <dt>我做了什么</dt>
            <dd>{p.contribution}</dd>
            <dt>最终效果</dt>
            <dd>{p.outcome}</dd>
          </dl>
          {/^https?:\/\//i.test(p.url) && (
            <a href={p.url} target="_blank" rel="noreferrer">
              查看作品 <ArrowRight size={16} />
            </a>
          )}
        </article>
      ))}
      {!projects.length && <p>作品正在整理中。</p>}
    </div>
  );
}
export function ProjectsPreview() {
  const state = useLoad('/public/library');
  return (
    <section className="feature-width feature-section">
      <SectionTitle title="作品与折腾" to="/projects" />
      <Status state={state} />
      {state.data && (
        <ProjectCards projects={state.data.projects.slice(0, 2)} />
      )}
    </section>
  );
}

export function ReadingTools({ article }) {
  const [progress, setProgress] = useState(0);
  const [resume, setResume] = useState(0);
  const saved = useRef(0);
  const ready = useRef(false);
  const key = `pv-reading-${article.id}`;
  useEffect(() => {
    try {
      const previous = JSON.parse(localStorage.getItem(key) || 'null');
      if (previous?.progress > 0.02 && previous.progress < 0.98)
        setResume(previous.progress);
    } catch {}
    const update = () => {
      const node = document.querySelector('.article-reading-main > .markdown');
      if (!node) return;
      const top = node.getBoundingClientRect().top + window.scrollY;
      const total = Math.max(1, node.offsetHeight - window.innerHeight + 160);
      const value = Math.min(
        1,
        Math.max(0, (window.scrollY - top + 120) / total),
      );
      setProgress(value);
      saved.current = value;
      if (ready.current) {
        try {
          localStorage.setItem(
            key,
            JSON.stringify({ progress: value, updatedAt: Date.now() }),
          );
        } catch {}
      }
    };
    const mark = () => {
      ready.current = true;
    };
    window.addEventListener('wheel', mark, { passive: true });
    window.addEventListener('touchmove', mark, { passive: true });
    window.addEventListener('keydown', mark);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      window.removeEventListener('wheel', mark);
      window.removeEventListener('touchmove', mark);
      window.removeEventListener('keydown', mark);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [key]);
  function continueReading() {
    const node = document.querySelector('.article-reading-main > .markdown');
    if (!node) return;
    ready.current = true;
    window.scrollTo({
      top:
        node.getBoundingClientRect().top +
        window.scrollY -
        120 +
        resume * Math.max(1, node.offsetHeight - window.innerHeight + 160),
      behavior: 'smooth',
    });
    setResume(0);
  }
  return (
    <>
      <div
        className="reading-progress"
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="reading-toolbar">
        <span>
          <Clock3 size={16} />约{' '}
          {Math.max(1, Math.ceil(article.content.length / 450))} 分钟阅读 · 已读{' '}
          {Math.round(progress * 100)}%
        </span>
        {resume > 0 && (
          <button onClick={continueReading}>
            继续上次阅读（{Math.round(resume * 100)}%）
          </button>
        )}
      </div>
    </>
  );
}
export function RelatedReading({ data }) {
  return (
    <>
      <TripLinks trips={data.trips} />
      <nav className="adjacent-articles" aria-label="相邻文章">
        {data.previous ? (
          <SiteLink to={`/article/${data.previous.slug}`}>
            <small>上一篇</small>
            <strong>{data.previous.title}</strong>
          </SiteLink>
        ) : (
          <span />
        )}
        {data.next && (
          <SiteLink to={`/article/${data.next.slug}`}>
            <small>下一篇</small>
            <strong>{data.next.title}</strong>
          </SiteLink>
        )}
      </nav>
    </>
  );
}

export function VisibilitySelect({ value, onChange }) {
  return (
    <label>
      可见范围
      <select
        value={value || 'private'}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="private">仅自己可见</option>
        <option value="public">公开</option>
      </select>
    </label>
  );
}
export function ArticleOptions({ form, setForm }) {
  return (
    <div className="extra-fields">
      <VisibilitySelect
        value={form.visibility}
        onChange={(visibility) => setForm({ ...form, visibility })}
      />
      <label>
        归档年份
        <input
          type="number"
          min="1900"
          max="2099"
          value={form.year || ''}
          placeholder="自动识别"
          onChange={(e) => setForm({ ...form, year: e.target.value })}
        />
      </label>
    </div>
  );
}

// Autosaves a separate working copy; never publishes or modifies the public article.
const draftQueues = new Map();
const completedDrafts = new Set();
export async function discardWorkingCopy(key) {
  completedDrafts.add(key);
  await (draftQueues.get(key) || Promise.resolve()).catch(() => {});
  await request(`/admin/drafts/${key}`, {
    method: 'PUT',
    body: { form: null },
  });
}
export function DraftKeeper({ draftKey, form, onRestore, savedSignal = 0 }) {
  const [recovery, setRecovery] = useState(null);
  const [message, setMessage] = useState('');
  const initial = useRef(JSON.stringify(form));
  const formRef = useRef(form);
  formRef.current = form;
  const chain = useRef(Promise.resolve());
  useEffect(() => {
    completedDrafts.delete(draftKey);
    let alive = true;
    request(`/admin/drafts/${draftKey}`)
      .then(({ draft }) => {
        if (
          alive &&
          draft?.form &&
          JSON.stringify(draft.form) !== initial.current
        )
          setRecovery(draft);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [draftKey]);
  useEffect(() => {
    const serialized = JSON.stringify(form);
    if (serialized === initial.current) return;
    setMessage('正在保存工作副本…');
    const timer = setTimeout(() => {
      chain.current = chain.current
        .catch(() => {})
        .then(
          () =>
            !completedDrafts.has(draftKey) &&
            request(`/admin/drafts/${draftKey}`, {
              method: 'PUT',
              body: { form },
            }),
        );
      draftQueues.set(draftKey, chain.current);
      chain.current
        .then(() => setMessage('工作副本已自动保存，尚未发布'))
        .catch(() => setMessage('自动保存失败，请手动保存或稍后重试'));
    }, 900);
    return () => clearTimeout(timer);
  }, [form, draftKey, savedSignal]);
  useEffect(
    () => () => {
      if (
        !completedDrafts.has(draftKey) &&
        JSON.stringify(formRef.current) !== initial.current
      ) {
        chain.current = chain.current
          .catch(() => {})
          .then(
            () =>
              !completedDrafts.has(draftKey) &&
              request(`/admin/drafts/${draftKey}`, {
                method: 'PUT',
                body: { form: formRef.current },
              }),
          )
          .catch(() => {});
        draftQueues.set(draftKey, chain.current);
      }
    },
    [draftKey],
  );
  return (
    <div className="draft-notice">
      <span role="status">{message || '编辑时自动保存独立工作副本'}</span>
      {recovery && (
        <div>
          发现 {new Date(recovery.updatedAt).toLocaleString('zh-CN')}{' '}
          的工作副本。
          <button
            type="button"
            onClick={() => {
              onRestore(recovery.form);
              setRecovery(null);
            }}
          >
            恢复到编辑器
          </button>
          <button type="button" onClick={() => setRecovery(null)}>
            暂不恢复
          </button>
        </div>
      )}
    </div>
  );
}
export function RevisionHistory({ articleId, onRestore }) {
  const [revisions, setRevisions] = useState(null);
  const [error, setError] = useState('');
  if (!articleId) return null;
  return (
    <details
      className="revision-history"
      onToggle={(e) => {
        if (e.currentTarget.open)
          request(`/admin/articles/${articleId}/revisions`)
            .then((r) => setRevisions(r.revisions))
            .catch((e) => setError(e.message));
      }}
    >
      <summary>修改历史（保留最近 50 版）</summary>
      {error && <p role="alert">{error}</p>}
      {revisions?.length === 0 && <p>保存修改后会保留上一版本。</p>}
      {revisions?.map((r) => (
        <div key={r.revisionId}>
          <span>
            {new Date(r.savedAt).toLocaleString('zh-CN')} · {r.title}
          </span>
          <button type="button" onClick={() => onRestore(r)}>
            载入此版本
          </button>
        </div>
      ))}
    </details>
  );
}

const TITLES = {
  moments: '此刻短记',
  years: '年度档案',
  projects: '作品与折腾',
  trips: '旅行故事',
};
function emptyEntry() {
  return {
    title: '',
    content: '',
    date: new Date().toISOString().slice(0, 10),
    year: String(new Date().getFullYear()),
    imageUrl: '',
    theme: '',
    reflection: '',
    purpose: '',
    contribution: '',
    outcome: '',
    url: '',
    place: '',
    visibility: 'private',
    status: 'draft',
    articleIds: [],
    albumIds: [],
    photoIds: [],
  };
}
export function AdminLibrary() {
  const [kind, setKind] = useState('moments');
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const sources = useLoad('/admin/articles');
  const albums = useLoad('/admin/albums');
  useEffect(() => {
    let alive = true;
    setEntries([]);
    request(`/admin/content/${kind}`)
      .then((r) => alive && setEntries(r.entries))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [kind, refresh]);
  function field(key, label, type = 'text') {
    return (
      <label key={key}>
        {label}
        {type === 'textarea' ? (
          <textarea
            rows={4}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        ) : (
          <input
            type={type}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            required={
              ['date', 'year'].includes(key) ||
              (key === 'title' && kind !== 'moments')
            }
          />
        )}
      </label>
    );
  }
  function selection(key, label, items) {
    return (
      <fieldset className="relation-picker">
        <legend>{label}</legend>
        {items.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={form[key].includes(item.id)}
              onChange={(e) =>
                setForm({
                  ...form,
                  [key]: e.target.checked
                    ? [...form[key], item.id]
                    : form[key].filter((id) => id !== item.id),
                })
              }
            />
            {item.title}
            {item.visibility === 'private' ? '（私密）' : ''}
          </label>
        ))}
        {!items.length && <p>暂无可关联内容</p>}
      </fieldset>
    );
  }
  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await request(`/admin/content/${kind}${form.id ? `/${form.id}` : ''}`, {
        method: form.id ? 'PUT' : 'POST',
        body: form,
      });
      await discardWorkingCopy(`${kind}-${form.id || 'new'}`);
      setForm(null);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const result = await request('/admin/uploads', {
        method: 'POST',
        body: data,
      });
      setForm((current) => ({ ...current, imageUrl: result.url }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-section">
      <div className="section-title">
        <h1>生活内容</h1>
        <p>整理短记、年度档案、作品和旅行。私密内容仅在后台可见。</p>
      </div>
      <div className="library-tabs">
        {Object.entries(TITLES).map(([k, title]) => (
          <button
            key={k}
            className={kind === k ? 'active' : ''}
            onClick={() => {
              setKind(k);
              setForm(null);
              setError('');
            }}
          >
            {title}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {!form ? (
        <>
          <button
            className="admin-primary-button"
            onClick={() => setForm(emptyEntry())}
          >
            <Plus size={17} />
            新增{TITLES[kind]}
          </button>
          <div className="admin-list">
            {entries.map((entry) => (
              <div className="admin-row" key={entry.id}>
                <div>
                  <strong>{entry.title || entry.content.slice(0, 45)}</strong>
                  <span>
                    {entry.date} ·{' '}
                    {entry.visibility === 'public' ? '公开' : '仅自己'} ·{' '}
                    {entry.status === 'draft' ? '草稿' : '已发布'}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    onClick={() => setForm({ ...emptyEntry(), ...entry })}
                  >
                    编辑
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm('确定删除这条记录？建议先导出备份。'))
                        return;
                      try {
                        await request(`/admin/content/${kind}/${entry.id}`, {
                          method: 'DELETE',
                        });
                        setRefresh((n) => n + 1);
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {!entries.length && (
              <p className="feature-status">暂无记录，点击新增开始整理。</p>
            )}
          </div>
        </>
      ) : (
        <form className="admin-form library-editor" onSubmit={save}>
          <DraftKeeper
            key={`${kind}-${form.id || 'new'}`}
            draftKey={`${kind}-${form.id || 'new'}`}
            form={form}
            onRestore={setForm}
          />
          {field('title', kind === 'moments' ? '标题（可选）' : '标题')}
          {field('date', '记录日期', 'date')}
          {kind === 'years' && field('year', '年份', 'number')}
          {kind === 'trips' && field('place', '地点')}
          {kind === 'years' && field('theme', '一句年度主题')}
          {field(
            'content',
            kind === 'years'
              ? '重要经历（支持 Markdown）'
              : kind === 'moments'
                ? '写下此刻'
                : '介绍（支持 Markdown）',
            'textarea',
          )}
          {kind === 'years' &&
            field('reflection', '今天回看（支持 Markdown）', 'textarea')}
          {kind === 'projects' && (
            <>
              {field('purpose', '为什么做', 'textarea')}
              {field('contribution', '我做了什么', 'textarea')}
              {field('outcome', '最终效果', 'textarea')}
              {field('url', '作品链接', 'url')}
            </>
          )}
          {field('imageUrl', '配图地址')}
          <label className="file-button">
            上传配图
            <input type="file" accept="image/*" onChange={upload} />
          </label>
          <div className="extra-fields">
            <VisibilitySelect
              value={form.visibility}
              onChange={(visibility) => setForm({ ...form, visibility })}
            />
            <label>
              状态
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">草稿</option>
                <option value="published">发布</option>
              </select>
            </label>
          </div>
          {['years', 'trips'].includes(kind) && (
            <>
              {selection(
                'articleIds',
                '关联文章',
                sources.data?.articles || [],
              )}
              {selection('albumIds', '关联相册', albums.data?.albums || [])}
            </>
          )}
          {kind === 'years' &&
            selection(
              'photoIds',
              '精选照片（也可以直接关联整本相册）',
              albums.data?.albums.flatMap((a) => a.photos) || [],
            )}
          <div className="modal-actions">
            <button type="button" onClick={() => setForm(null)}>
              返回列表
            </button>
            <button
              type="submit"
              disabled={busy}
              className="admin-primary-button"
            >
              <Save size={17} />
              {busy ? '正在保存…' : '保存记录'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
export function BackupPanel() {
  return (
    <section className="backup-panel">
      <h2>导出完整备份</h2>
      <p>
        包含文章、短记、年度档案、作品、旅行、修改历史、工作副本和上传的照片。请保存在自己的设备中。
      </p>
      <a className="admin-primary-button" href={`${BASE}/api/admin/backup`}>
        <Download size={18} />
        下载备份（.tar.gz）
      </a>
      <p>
        恢复时将 data.json 与 uploads
        目录放回服务端数据目录；覆盖前请先保留现有备份。
      </p>
    </section>
  );
}
