import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  BarChart3,
  Calendar,
  Camera,
  Edit3,
  Eye,
  FileText,
  Folder,
  Home,
  ImagePlus,
  Layers,
  LogOut,
  MessageCircle,
  MessageSquare,
  Plus,
  Reply,
  Save,
  Send,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Upload
} from 'lucide-react';
import './styles.css';

const BASE_PATH = (import.meta.env.BASE_URL || '/princevlog/').replace(/\/$/, '');
const API_BASE = `${BASE_PATH}/api`;

function routeFromLocation() {
  const pathname = window.location.pathname.startsWith(BASE_PATH)
    ? window.location.pathname.slice(BASE_PATH.length)
    : window.location.pathname;
  return `${pathname || '/'}${window.location.search || ''}`;
}

async function api(endpoint, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    },
    body: isFormData || !options.body ? options.body : JSON.stringify(options.body)
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.error || '请求失败');
  }
  return payload;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

function Markdown({ content }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(content || '')), [content]);
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

function IconButton({ icon: Icon, children, className = '', ...props }) {
  return (
    <button className={`icon-button ${className}`} {...props}>
      {Icon ? <Icon size={18} /> : null}
      <span>{children}</span>
    </button>
  );
}

function usePageData(loader, deps = []) {
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    loader()
      .then((data) => alive && setState({ loading: false, error: '', data }))
      .catch((error) => alive && setState({ loading: false, error: error.message, data: null }));
    return () => {
      alive = false;
    };
  }, deps);

  return state;
}

function Shell({ route, navigate }) {
  const path = route.split('?')[0];

  if (path.startsWith('/admin')) {
    return <AdminApp navigate={navigate} />;
  }

  return (
    <PublicLayout navigate={navigate} path={path}>
      {path === '/' && <HomePage navigate={navigate} />}
      {path === '/articles' && <ArticleListPage navigate={navigate} />}
      {path.startsWith('/article/') && <ArticleDetailPage identifier={decodeURIComponent(path.replace('/article/', ''))} />}
      {path === '/gallery' && <GalleryPage />}
    </PublicLayout>
  );
}

function PublicLayout({ children, navigate, path }) {
  return (
    <>
      <header className="site-header">
        <button className="brand" onClick={() => navigate('/')}>
          <span className="brand-mark">PV</span>
          <span>PrinceVlog</span>
        </button>
        <nav>
          <button className={path === '/' ? 'active' : ''} onClick={() => navigate('/')}>
            <Home size={17} />首页
          </button>
          <button className={path === '/articles' ? 'active' : ''} onClick={() => navigate('/articles')}>
            <FileText size={17} />文章
          </button>
          <button className={path === '/gallery' ? 'active' : ''} onClick={() => navigate('/gallery')}>
            <Camera size={17} />相册
          </button>
          <button onClick={() => navigate('/admin')}>
            <Shield size={17} />后台
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}

function HomePage({ navigate }) {
  const { loading, error, data } = usePageData(() => api('/public/bootstrap'), []);
  const settings = data?.settings || {};
  const recommended = data?.recommendedArticles || [];
  const latest = data?.latestArticles || [];
  const categories = data?.categories || [];
  const albums = data?.albums || [];
  const mottoes = settings.mottoes || [];

  if (loading) return <Loading label="正在加载 PrinceVlog" />;
  if (error) return <ErrorView message={error} />;

  return (
    <div className="home">
      <section className="hero-section">
        <div className="hero-media" />
        <div className="hero-content">
          <div className="eyebrow"><Sparkles size={18} />PrinceVlog</div>
          <h1>{settings.siteTitle || 'PrinceVlog'}</h1>
          <p>{settings.heroSubtitle || '记录文字、照片和人生路上的灵感。'}</p>
          <div className="hero-actions">
            <IconButton icon={FileText} onClick={() => navigate('/articles')}>阅读文章</IconButton>
            <IconButton icon={Camera} className="ghost" onClick={() => navigate('/gallery')}>浏览相册</IconButton>
          </div>
        </div>
      </section>

      <section className="motto-strip">
        <div className="motto-track">
          {[...mottoes, ...mottoes].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </section>

      <section className="content-band">
        <div className="section-head">
          <span>Featured</span>
          <h2>推荐文章</h2>
          <p>置顶那些值得反复回看的记录。</p>
        </div>
        <div className="article-grid">
          {recommended.map((article) => (
            <ArticleCard key={article.id} article={article} navigate={navigate} featured />
          ))}
          {recommended.length === 0 ? <EmptyState text="后台设置推荐文章后会显示在这里。" /> : null}
        </div>
      </section>

      <section className="split-band">
        <div>
          <div className="section-head compact">
            <span>Categories</span>
            <h2>文章分类</h2>
          </div>
          <div className="category-list">
            {categories.map((category) => (
              <button key={category.id} onClick={() => navigate(`/articles?category=${encodeURIComponent(category.slug)}`)}>
                <Layers size={18} />
                <strong>{category.name}</strong>
                <small>{category.description || category.slug}</small>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="section-head compact">
            <span>Latest</span>
            <h2>最新文章</h2>
          </div>
          <div className="latest-list">
            {latest.slice(0, 5).map((article) => (
              <button key={article.id} onClick={() => navigate(`/article/${article.slug}`)}>
                <span>{formatDate(article.updatedAt)}</span>
                <strong>{article.title}</strong>
                <small>{article.categoryName}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="content-band">
        <div className="section-head">
          <span>Gallery</span>
          <h2>相簿照片墙</h2>
          <p>按文件夹沉淀主题，也按日期保留时间线。</p>
        </div>
        <div className="album-preview">
          {albums.map((album) => (
            <button key={album.id} onClick={() => navigate('/gallery')}>
              <img src={album.coverUrl || album.photos?.[0]?.imageUrl} alt={album.title} />
              <span>{album.title}</span>
            </button>
          ))}
        </div>
      </section>

      <MessageBoard initialMessages={data?.messages || []} />
    </div>
  );
}

function ArticleCard({ article, navigate, featured = false }) {
  return (
    <article className={`article-card ${featured ? 'featured' : ''}`}>
      <button onClick={() => navigate(`/article/${article.slug}`)}>
        <img src={article.coverUrl || 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80'} alt={article.title} />
        <div>
          <span className="pill">{article.categoryName}</span>
          <h3>{article.title}</h3>
          <p>{article.subtitle || article.excerpt || '打开文章，继续阅读。'}</p>
          <footer>
            <span><Eye size={15} />{article.viewCount || 0}</span>
            {article.recommended ? <span><Star size={15} />推荐</span> : null}
          </footer>
        </div>
      </button>
    </article>
  );
}

function ArticleListPage({ navigate }) {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category') || '';
  const { loading, error, data } = usePageData(() => api(`/public/articles${category ? `?category=${encodeURIComponent(category)}` : ''}`), [category]);
  const articles = data?.articles || [];

  if (loading) return <Loading label="正在加载文章" />;
  if (error) return <ErrorView message={error} />;

  return (
    <section className="page-shell">
      <div className="page-title">
        <span>Articles</span>
        <h1>{category ? '分类文章' : '全部文章'}</h1>
      </div>
      <div className="article-grid">
        {articles.map((article) => <ArticleCard key={article.id} article={article} navigate={navigate} />)}
      </div>
      {articles.length === 0 ? <EmptyState text="这个分类暂时还没有文章。" /> : null}
    </section>
  );
}

function ArticleDetailPage({ identifier }) {
  const [comment, setComment] = useState({ author: '', content: '' });
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, error, data } = usePageData(() => api(`/public/articles/${encodeURIComponent(identifier)}`), [identifier, refreshKey]);

  async function submitComment(event) {
    event.preventDefault();
    await api(`/public/articles/${encodeURIComponent(identifier)}/comments`, {
      method: 'POST',
      body: comment
    });
    setComment({ author: '', content: '' });
    setRefreshKey((value) => value + 1);
  }

  if (loading) return <Loading label="正在打开文章" />;
  if (error) return <ErrorView message={error} />;

  const article = data.article;
  const comments = data.comments || [];

  return (
    <article className="article-detail">
      <header>
        <img src={article.coverUrl || 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1400&q=80'} alt={article.title} />
        <div>
          <span className="pill">{article.categoryName}</span>
          <h1>{article.title}</h1>
          <p>{article.subtitle}</p>
          <small>{formatDate(article.updatedAt)} · {article.viewCount || 0} 次阅读</small>
        </div>
      </header>
      <Markdown content={article.content} />
      <section className="comment-section">
        <h2>评论</h2>
        <form className="comment-form" onSubmit={submitComment}>
          <input value={comment.author} onChange={(event) => setComment({ ...comment, author: event.target.value })} placeholder="你的名字" />
          <textarea value={comment.content} onChange={(event) => setComment({ ...comment, content: event.target.value })} placeholder="写下你的评论" required />
          <IconButton icon={Send}>发布评论</IconButton>
        </form>
        <div className="comment-list">
          {comments.map((item) => (
            <div className="comment-item" key={item.id}>
              <strong>{item.author}</strong>
              <p>{item.content}</p>
              {item.reply ? <blockquote>{item.reply}</blockquote> : null}
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}

function GalleryPage() {
  const [mode, setMode] = useState('folder');
  const { loading, error, data } = usePageData(() => api(`/public/albums?mode=${mode}`), [mode]);
  const albums = data?.albums || [];

  if (loading) return <Loading label="正在加载相册" />;
  if (error) return <ErrorView message={error} />;

  return (
    <section className="page-shell gallery-page">
      <div className="page-title row">
        <div>
          <span>Gallery</span>
          <h1>相簿照片墙</h1>
        </div>
        <div className="segmented">
          <button className={mode === 'folder' ? 'active' : ''} onClick={() => setMode('folder')}><Folder size={17} />文件夹</button>
          <button className={mode === 'date' ? 'active' : ''} onClick={() => setMode('date')}><Calendar size={17} />日期</button>
        </div>
      </div>
      {mode === 'folder' ? (
        <div className="album-wall">
          {albums.map((album) => (
            <section key={album.id} className="album-group">
              <div className="album-title">
                <h2>{album.title}</h2>
                <p>{album.description}</p>
              </div>
              <PhotoWall photos={album.photos || []} />
            </section>
          ))}
        </div>
      ) : (
        <div className="album-wall">
          {albums.map((group) => (
            <section key={group.date} className="album-group">
              <div className="album-title">
                <h2>{group.date}</h2>
              </div>
              <PhotoWall photos={group.photos || []} />
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function PhotoWall({ photos }) {
  return (
    <div className="photo-wall">
      {photos.map((photo) => (
        <figure key={photo.id}>
          <img src={photo.imageUrl} alt={photo.title} />
          <figcaption>
            <strong>{photo.title}</strong>
            <span>{photo.caption || photo.shotAt}</span>
          </figcaption>
        </figure>
      ))}
      {photos.length === 0 ? <EmptyState text="这个相簿还没有照片。" /> : null}
    </div>
  );
}

function MessageBoard({ initialMessages = [] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [form, setForm] = useState({ author: '', content: '' });

  async function submit(event) {
    event.preventDefault();
    const result = await api('/public/messages', { method: 'POST', body: form });
    setMessages([result.message, ...messages]);
    setForm({ author: '', content: '' });
  }

  return (
    <section className="message-board">
      <div className="section-head">
        <span>Message</span>
        <h2>留言板</h2>
        <p>把想说的话留在这里，我会在后台回复。</p>
      </div>
      <form className="message-form" onSubmit={submit}>
        <input value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="你的名字" />
        <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="写一条留言" required />
        <IconButton icon={Send}>提交留言</IconButton>
      </form>
      <div className="message-list">
        {messages.map((message) => (
          <div key={message.id} className="message-item">
            <strong>{message.author}</strong>
            <p>{message.content}</p>
            {message.reply ? <blockquote>{message.reply}</blockquote> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminApp({ navigate }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('analytics');

  useEffect(() => {
    api('/admin/me')
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await api('/admin/logout', { method: 'POST' });
    setUser(null);
  }

  if (loading) return <Loading label="正在进入后台" />;
  if (!user) return <LoginView onLogin={setUser} error={error} setError={setError} navigate={navigate} />;

  const tabs = [
    ['analytics', BarChart3, '数据'],
    ['articles', FileText, '文章'],
    ['categories', Layers, '分类'],
    ['albums', Camera, '相册'],
    ['messages', MessageSquare, '留言'],
    ['settings', Settings, '设置']
  ];

  return (
    <div className="admin-shell">
      <aside>
        <button className="brand admin-brand" onClick={() => navigate('/')}>
          <span className="brand-mark">PV</span>
          <span>PrinceVlog</span>
        </button>
        <div className="admin-nav">
          {tabs.map(([key, Icon, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              <Icon size={18} />{label}
            </button>
          ))}
        </div>
        <IconButton icon={LogOut} className="ghost" onClick={logout}>退出</IconButton>
      </aside>
      <section className="admin-main">
        {tab === 'analytics' && <AdminAnalytics />}
        {tab === 'articles' && <AdminArticles />}
        {tab === 'categories' && <AdminCategories />}
        {tab === 'albums' && <AdminAlbums />}
        {tab === 'messages' && <AdminEngagement />}
        {tab === 'settings' && <AdminSettings />}
      </section>
    </div>
  );
}

function LoginView({ onLogin, error, setError, navigate }) {
  const [form, setForm] = useState({ username: 'root', password: '' });

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const result = await api('/admin/login', { method: 'POST', body: form });
      onLogin(result.user);
    } catch (loginError) {
      setError(loginError.message);
    }
  }

  return (
    <div className="login-page">
      <button className="brand" onClick={() => navigate('/')}>
        <span className="brand-mark">PV</span>
        <span>PrinceVlog</span>
      </button>
      <form className="login-panel" onSubmit={submit}>
        <Shield size={34} />
        <h1>后台登录</h1>
        <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="账号" />
        <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="密码" type="password" />
        {error ? <p className="form-error">{error}</p> : null}
        <IconButton icon={Shield}>进入后台</IconButton>
      </form>
    </div>
  );
}

function AdminAnalytics() {
  const { loading, error, data } = usePageData(() => api('/admin/analytics'), []);
  if (loading) return <Loading label="正在统计访问数据" />;
  if (error) return <ErrorView message={error} />;
  const analytics = data.analytics;
  const cards = [
    ['请求量', analytics.totalRequests],
    ['访客', analytics.uniqueVisitors],
    ['今日请求', analytics.todayRequests],
    ['文章', analytics.articleCount],
    ['照片', analytics.photoCount],
    ['留言', analytics.messageCount]
  ];

  return (
    <AdminSection title="数据概览" subtitle="请求量、访客、IP、省份和访问时间。">
      <div className="stats-grid">
        {cards.map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="admin-columns">
        <DataTable title="最近访问" rows={analytics.recentVisits} columns={['ip', 'province', 'path', 'createdAt']} />
        <DataTable title="省份排行" rows={analytics.provinceStats} columns={['province', 'count']} />
      </div>
    </AdminSection>
  );
}

function AdminArticles() {
  const empty = { title: '', subtitle: '', slug: '', coverUrl: '', categoryId: '', excerpt: '', content: '# 标题\n\n正文内容', recommended: false, status: 'published' };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { data } = usePageData(async () => {
    const [articles, categories] = await Promise.all([api('/admin/articles'), api('/admin/categories')]);
    return { articles: articles.articles, categories: categories.categories };
  }, [refresh]);

  async function save(event) {
    event.preventDefault();
    await api(editingId ? `/admin/articles/${editingId}` : '/admin/articles', {
      method: editingId ? 'PUT' : 'POST',
      body: form
    });
    setForm(empty);
    setEditingId('');
    setRefresh((value) => value + 1);
  }

  async function uploadCover(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const result = await api('/admin/uploads', { method: 'POST', body: fd });
    setForm({ ...form, coverUrl: result.url });
  }

  async function remove(id) {
    if (!window.confirm('确定删除这篇文章吗？')) return;
    await api(`/admin/articles/${id}`, { method: 'DELETE' });
    setRefresh((value) => value + 1);
  }

  return (
    <AdminSection title="文章管理" subtitle="编辑 Markdown 正文，设置标题、封面、小标题、分类和推荐。">
      <form className="admin-form" onSubmit={save}>
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="标题" required />
        <input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} placeholder="小标题" />
        <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="URL Slug" />
        <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          <option value="">未分类</option>
          {(data?.categories || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <div className="inline-fields">
          <label><input type="checkbox" checked={form.recommended} onChange={(event) => setForm({ ...form, recommended: event.target.checked })} />推荐</label>
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="published">发布</option>
            <option value="draft">草稿</option>
          </select>
          <label className="file-button"><Upload size={17} />上传封面<input type="file" accept="image/*" onChange={uploadCover} /></label>
        </div>
        <input value={form.coverUrl} onChange={(event) => setForm({ ...form, coverUrl: event.target.value })} placeholder="封面 URL" />
        <input value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} placeholder="摘要" />
        <textarea className="markdown-editor" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
        <IconButton icon={Save}>{editingId ? '保存修改' : '新增文章'}</IconButton>
      </form>
      <div className="admin-list">
        {(data?.articles || []).map((article) => (
          <div className="admin-row" key={article.id}>
            <div>
              <strong>{article.title}</strong>
              <span>{article.categoryName} · {article.status} · {article.recommended ? '推荐' : '普通'}</span>
            </div>
            <div className="row-actions">
              <button onClick={() => { setEditingId(article.id); setForm({ ...empty, ...article }); }}><Edit3 size={17} /></button>
              <button onClick={() => remove(article.id)}><Trash2 size={17} /></button>
            </div>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}

function AdminCategories() {
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [editingId, setEditingId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { data } = usePageData(() => api('/admin/categories'), [refresh]);

  async function save(event) {
    event.preventDefault();
    await api(editingId ? `/admin/categories/${editingId}` : '/admin/categories', {
      method: editingId ? 'PUT' : 'POST',
      body: form
    });
    setForm({ name: '', slug: '', description: '' });
    setEditingId('');
    setRefresh((value) => value + 1);
  }

  async function remove(id) {
    if (!window.confirm('确定删除这个分类吗？相关文章会变成未分类。')) return;
    await api(`/admin/categories/${id}`, { method: 'DELETE' });
    setRefresh((value) => value + 1);
  }

  return (
    <AdminSection title="分类管理" subtitle="文章可按分类聚合展示，也可在首页进入分类。">
      <form className="admin-form compact-form" onSubmit={save}>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="分类名称" required />
        <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Slug" />
        <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="描述" />
        <IconButton icon={Plus}>{editingId ? '保存分类' : '新增分类'}</IconButton>
      </form>
      <div className="admin-list">
        {(data?.categories || []).map((category) => (
          <div className="admin-row" key={category.id}>
            <div><strong>{category.name}</strong><span>{category.slug} · {category.description}</span></div>
            <div className="row-actions">
              <button onClick={() => { setEditingId(category.id); setForm(category); }}><Edit3 size={17} /></button>
              <button onClick={() => remove(category.id)}><Trash2 size={17} /></button>
            </div>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}

function AdminAlbums() {
  const [albumForm, setAlbumForm] = useState({ title: '', folder: '', description: '', coverUrl: '' });
  const [photoForm, setPhotoForm] = useState({ albumId: '', title: '', caption: '', imageUrl: '', shotAt: new Date().toISOString().slice(0, 10) });
  const [refresh, setRefresh] = useState(0);
  const { data } = usePageData(() => api('/admin/albums'), [refresh]);

  async function saveAlbum(event) {
    event.preventDefault();
    await api('/admin/albums', { method: 'POST', body: albumForm });
    setAlbumForm({ title: '', folder: '', description: '', coverUrl: '' });
    setRefresh((value) => value + 1);
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const result = await api('/admin/uploads', { method: 'POST', body: fd });
    setPhotoForm({ ...photoForm, imageUrl: result.url });
  }

  async function savePhoto(event) {
    event.preventDefault();
    await api('/admin/photos', { method: 'POST', body: photoForm });
    setPhotoForm({ albumId: photoForm.albumId, title: '', caption: '', imageUrl: '', shotAt: new Date().toISOString().slice(0, 10) });
    setRefresh((value) => value + 1);
  }

  async function removePhoto(id) {
    await api(`/admin/photos/${id}`, { method: 'DELETE' });
    setRefresh((value) => value + 1);
  }

  return (
    <AdminSection title="相册管理" subtitle="按文件夹建立相簿，照片还能按拍摄日期自动形成时间墙。">
      <form className="admin-form compact-form" onSubmit={saveAlbum}>
        <input value={albumForm.title} onChange={(event) => setAlbumForm({ ...albumForm, title: event.target.value })} placeholder="相簿名" required />
        <input value={albumForm.folder} onChange={(event) => setAlbumForm({ ...albumForm, folder: event.target.value })} placeholder="文件夹标识" />
        <input value={albumForm.description} onChange={(event) => setAlbumForm({ ...albumForm, description: event.target.value })} placeholder="描述" />
        <input value={albumForm.coverUrl} onChange={(event) => setAlbumForm({ ...albumForm, coverUrl: event.target.value })} placeholder="封面 URL" />
        <IconButton icon={Folder}>新增相簿</IconButton>
      </form>
      <form className="admin-form compact-form" onSubmit={savePhoto}>
        <select value={photoForm.albumId} onChange={(event) => setPhotoForm({ ...photoForm, albumId: event.target.value })} required>
          <option value="">选择相簿</option>
          {(data?.albums || []).map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
        </select>
        <input value={photoForm.title} onChange={(event) => setPhotoForm({ ...photoForm, title: event.target.value })} placeholder="照片标题" required />
        <input type="date" value={photoForm.shotAt} onChange={(event) => setPhotoForm({ ...photoForm, shotAt: event.target.value })} />
        <label className="file-button"><ImagePlus size={17} />上传照片<input type="file" accept="image/*" onChange={uploadPhoto} /></label>
        <input value={photoForm.imageUrl} onChange={(event) => setPhotoForm({ ...photoForm, imageUrl: event.target.value })} placeholder="照片 URL" required />
        <input value={photoForm.caption} onChange={(event) => setPhotoForm({ ...photoForm, caption: event.target.value })} placeholder="说明" />
        <IconButton icon={Plus}>新增照片</IconButton>
      </form>
      <div className="admin-list">
        {(data?.albums || []).map((album) => (
          <div className="album-admin" key={album.id}>
            <h3>{album.title}</h3>
            <div className="mini-photo-grid">
              {(album.photos || []).map((photo) => (
                <figure key={photo.id}>
                  <img src={photo.imageUrl} alt={photo.title} />
                  <button onClick={() => removePhoto(photo.id)}><Trash2 size={16} /></button>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}

function AdminEngagement() {
  const [refresh, setRefresh] = useState(0);
  const { data } = usePageData(async () => {
    const [comments, messages] = await Promise.all([api('/admin/comments'), api('/admin/messages')]);
    return { comments: comments.comments, messages: messages.messages };
  }, [refresh]);

  async function reply(kind, id) {
    const value = window.prompt('输入回复内容');
    if (!value) return;
    await api(`/admin/${kind}/${id}/reply`, { method: 'PUT', body: { reply: value } });
    setRefresh((next) => next + 1);
  }

  async function remove(kind, id) {
    await api(`/admin/${kind}/${id}`, { method: 'DELETE' });
    setRefresh((next) => next + 1);
  }

  return (
    <AdminSection title="留言与评论" subtitle="查看用户留言和文章评论，并直接回复。">
      <div className="admin-columns">
        <EngagementList title="文章评论" kind="comments" rows={data?.comments || []} onReply={reply} onRemove={remove} />
        <EngagementList title="首页留言" kind="messages" rows={data?.messages || []} onReply={reply} onRemove={remove} />
      </div>
    </AdminSection>
  );
}

function EngagementList({ title, kind, rows, onReply, onRemove }) {
  return (
    <div className="engagement-list">
      <h3>{title}</h3>
      {rows.map((row) => (
        <div className="engagement-item" key={row.id}>
          <strong>{row.author}</strong>
          <p>{row.content}</p>
          {row.articleTitle ? <small>{row.articleTitle}</small> : null}
          {row.reply ? <blockquote>{row.reply}</blockquote> : null}
          <div className="row-actions">
            <button onClick={() => onReply(kind, row.id)}><Reply size={16} /></button>
            <button onClick={() => onRemove(kind, row.id)}><Trash2 size={16} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminSettings() {
  const [form, setForm] = useState({ siteTitle: '', heroSubtitle: '', ownerName: '', mottoes: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/admin/settings').then((result) => {
      const settings = result.settings;
      setForm({
        siteTitle: settings.siteTitle || '',
        heroSubtitle: settings.heroSubtitle || '',
        ownerName: settings.ownerName || '',
        mottoes: (settings.mottoes || []).join('\n')
      });
    });
  }, []);

  async function save(event) {
    event.preventDefault();
    await api('/admin/settings', {
      method: 'PUT',
      body: { ...form, mottoes: form.mottoes.split('\n') }
    });
    setMessage('已保存');
    setTimeout(() => setMessage(''), 1600);
  }

  return (
    <AdminSection title="站点设置" subtitle="首页标题、副标题和滚动人生格言都在这里维护。">
      <form className="admin-form" onSubmit={save}>
        <input value={form.siteTitle} onChange={(event) => setForm({ ...form, siteTitle: event.target.value })} placeholder="站点标题" />
        <input value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} placeholder="作者名" />
        <textarea value={form.heroSubtitle} onChange={(event) => setForm({ ...form, heroSubtitle: event.target.value })} placeholder="首页副标题" />
        <textarea value={form.mottoes} onChange={(event) => setForm({ ...form, mottoes: event.target.value })} placeholder="每行一句人生格言" />
        <IconButton icon={Save}>保存设置</IconButton>
        {message ? <span className="success-text">{message}</span> : null}
      </form>
    </AdminSection>
  );
}

function AdminSection({ title, subtitle, children }) {
  return (
    <div className="admin-section">
      <header>
        <span>Admin</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      {children}
    </div>
  );
}

function DataTable({ title, rows, columns }) {
  return (
    <div className="data-table">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `${title}-${index}`}>
              {columns.map((column) => <td key={column}>{column === 'createdAt' ? formatDate(row[column]) : row[column]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Loading({ label }) {
  return <div className="state-view"><div className="loader" /><p>{label}</p></div>;
}

function ErrorView({ message }) {
  return <div className="state-view error"><p>{message}</p></div>;
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function App() {
  const [route, setRoute] = useState(routeFromLocation());

  useEffect(() => {
    const onPop = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to) => {
    window.history.pushState(null, '', `${BASE_PATH}${to}`);
    setRoute(routeFromLocation());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return <Shell route={route} navigate={navigate} />;
}

createRoot(document.getElementById('root')).render(<App />);
