import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  BarChart3,
  Calendar,
  Camera,
  Check,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Folder,
  Github,
  Home,
  ImagePlus,
  Layers,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Palette,
  Plus,
  Reply,
  Save,
  Send,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserRound,
  X
} from 'lucide-react';
import './styles.css';
import aboutAvatarUrl from './assets/about-avatar.jpg';

const BASE_PATH = (import.meta.env.BASE_URL || '/princevlog/').replace(/\/$/, '');
const API_BASE = `${BASE_PATH}/api`;
const PROFILE_CHAT_UNKNOWN = '这个问题我从 Prince 的文章里没有找到可靠信息，建议你直接问他本人。';
const suggestedProfileQuestions = [
  'Prince 这几年最大的变化是什么？',
  '他经历过哪些重要转折？',
  '他是一个什么样的人？'
];
const PUBLIC_THEMES = [
  { id: 'nocturne', label: '夜航', colors: ['#d8b4fe', '#22d3ee', '#0f172a'] },
  { id: 'ink', label: '墨境', colors: ['#f8fafc', '#64748b', '#020617'] },
  { id: 'ember', label: '余烬', colors: ['#f59e0b', '#fb7185', '#180b08'] },
  { id: 'ether', label: '星雾', colors: ['#a7f3d0', '#818cf8', '#050816'] },
  { id: 'lumen', label: '晨光', colors: ['#f8fafc', '#facc15', '#38bdf8'] },
  { id: 'paper', label: '纸境', colors: ['#fff7ed', '#0f766e', '#111827'] }
];

function readStoredPublicTheme() {
  try {
    const stored = window.localStorage.getItem('princevlog-public-theme');
    return PUBLIC_THEMES.some((item) => item.id === stored) ? stored : PUBLIC_THEMES[0].id;
  } catch {
    return PUBLIC_THEMES[0].id;
  }
}

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

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (item) => String(item).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  ].join(' ');
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

function FadeIn({ children, className = '', delay = 0, tag: Tag = 'div', ...props }) {
  const ref = useCallback((node) => {
    if (!node) return;
    if (delay) node.style.transitionDelay = `${delay}ms`;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add('visible');
          observer.unobserve(node);
        }
      },
      { threshold: 0.06 }
    );
    observer.observe(node);
  }, [delay]);

  return <Tag ref={ref} className={`fade-in ${className}`} {...props}>{children}</Tag>;
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-mark">PV</span>
          <span>PrinceVlog</span>
        </div>
        <p>用文字和照片记录生活中的灵感与感动</p>
        <small>&copy; {new Date().getFullYear()} PrinceVlog</small>
      </div>
    </footer>
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
      {path === '/timeline' && <TimelinePage navigate={navigate} />}
      {path.startsWith('/article/') && <ArticleDetailPage identifier={decodeURIComponent(path.replace('/article/', ''))} />}
      {path === '/gallery' && <GalleryPage />}
    </PublicLayout>
  );
}

function PublicLayout({ children, navigate, path }) {
  const [theme, setTheme] = useState(readStoredPublicTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem('princevlog-public-theme', theme);
    } catch {
      // Storage can be unavailable in private or embedded browsing contexts.
    }
  }, [theme]);

  function scrollToAboutMe() {
    const scroll = () => {
      const target = document.getElementById('about-me');
      const header = document.querySelector('.site-header');
      if (!target) return;
      const offset = (header?.offsetHeight || 0) + 24;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };
    if (path !== '/') {
      navigate('/');
      window.setTimeout(scroll, 160);
      return;
    }
    scroll();
  }

  return (
    <div className="public-shell" data-theme={theme}>
      <header className="site-header">
        <button className="brand" onClick={() => navigate('/')}>
          <span className="brand-mark">PV</span>
          <span>PrinceVlog</span>
        </button>
        <div className="header-actions">
          <nav aria-label="前台导航">
            <button className={path === '/' ? 'active' : ''} aria-label="首页" onClick={() => navigate('/')}>
              <Home size={17} /><span>首页</span>
            </button>
            <button className={path === '/articles' ? 'active' : ''} aria-label="文章" onClick={() => navigate('/articles')}>
              <FileText size={17} /><span>文章</span>
            </button>
            <button className={path === '/timeline' ? 'active' : ''} aria-label="时间轴" onClick={() => navigate('/timeline')}>
              <Clock3 size={17} /><span>时间轴</span>
            </button>
            <button className={path === '/gallery' ? 'active' : ''} aria-label="相册" onClick={() => navigate('/gallery')}>
              <Camera size={17} /><span>相册</span>
            </button>
            <button aria-label="About me" onClick={scrollToAboutMe}>
              <UserRound size={17} /><span>About me</span>
            </button>
            <button aria-label="后台" onClick={() => navigate('/admin')}>
              <Shield size={17} /><span>后台</span>
            </button>
          </nav>
          <StyleSwitcher theme={theme} onChange={setTheme} />
        </div>
      </header>
      <main>{children}</main>
      <Footer />
    </div>
  );
}

function StyleSwitcher({ theme, onChange }) {
  const [open, setOpen] = useState(false);
  const activeTheme = PUBLIC_THEMES.find((item) => item.id === theme) || PUBLIC_THEMES[0];

  function chooseTheme(id) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="style-switcher">
      <button
        type="button"
        className="style-trigger"
        aria-label="选择首页风格"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Palette size={17} />
        <span>风格</span>
        <i className="style-current" style={{ background: activeTheme.colors[0] }} />
      </button>
      {open ? (
        <div className="style-menu" role="menu" aria-label="首页风格">
          {PUBLIC_THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={theme === item.id ? 'active' : ''}
              role="menuitemradio"
              aria-checked={theme === item.id}
              onClick={() => chooseTheme(item.id)}
            >
              <span className="theme-swatch" aria-hidden="true">
                {item.colors.map((color) => <i key={color} style={{ background: color }} />)}
              </span>
              <span>{item.label}</span>
              {theme === item.id ? <Check size={15} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
  const heroThought = mottoes[0] || '把时间交给热爱，答案会在静处慢慢长出来。';
  const mottoLoop = mottoes.length > 0 ? mottoes : [heroThought];
  const heroSignals = [
    { label: '推荐', value: recommended.length },
    { label: '最新', value: latest.length },
    { label: '分类', value: categories.length },
    { label: '相簿', value: albums.length }
  ];

  function scrollToProfileChat() {
    document.getElementById('profile-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) return <Loading label="正在加载 PrinceVlog" />;
  if (error) return <ErrorView message={error} />;

  return (
    <div className="home">
      <section className="hero-section">
        <div className="hero-media" />
        <div className="hero-content">
          <div className="hero-title-stage">
            <div className="eyebrow"><Sparkles size={18} />PrinceVlog</div>
            <h1>{settings.siteTitle || 'PrinceVlog'}</h1>
            <p>{settings.heroSubtitle || '记录文字、照片和人生路上的灵感。'}</p>
          </div>
          <div className="hero-primary-panel" aria-label="首页主要功能">
            <div className="hero-actions">
              <IconButton icon={FileText} onClick={() => navigate('/articles')}>阅读文章</IconButton>
              <IconButton icon={Camera} className="ghost" onClick={() => navigate('/gallery')}>浏览相册</IconButton>
              <IconButton icon={MessageCircle} className="ghost" onClick={scrollToProfileChat}>问问 AI</IconButton>
            </div>
            <div className="hero-signal-row" aria-label="首页内容概览">
              {heroSignals.map((item) => (
                <span key={item.label}>
                  <strong>{item.value}</strong>
                  <small>{item.label}</small>
                </span>
              ))}
            </div>
          </div>
          <aside
            className="hero-thought-panel"
            aria-label="首页哲思"
            style={{ '--motto-duration': `${Math.max(mottoLoop.length, 1) * 5.6}s` }}
          >
            <span>Field Note</span>
            <div className={`motto-fade-stack hero-motto-stack ${mottoLoop.length === 1 ? 'single' : ''}`}>
              {mottoLoop.map((item, index) => (
                <p key={`${item}-${index}`} style={{ '--motto-index': index }}>{item}</p>
              ))}
            </div>
            <small>{settings.ownerName || 'Prince'} / still moving</small>
          </aside>
        </div>
      </section>

      <FadeIn tag="section" className="about-me-section" id="about-me">
        <div className="about-avatar-card">
          <img src={aboutAvatarUrl} alt="PrinceVlog 个人头像" />
          <span>正在加载阳光能量</span>
        </div>
        <div className="about-copy">
          <span className="about-kicker"><Sparkles size={16} />About me</span>
          <h2>阳光小简历</h2>
          <p>
            嗨，我是 Prince。一个一边赶路、一边把生活写进年终总结的人。
            这些年我在考试、工作、城市迁移、爬山和自我修复之间来回闯关：
            有时认真到冒烟，有时快乐到起飞，但总体方向一直是向前、向亮、向更大的世界。
          </p>
          <p>
            我喜欢把生活拆成文章、照片和时间轴，也喜欢在复盘里给自己递一杯热乎乎的鼓励。
            人生进度条偶尔卡顿，但我会笑着继续加载；如果今天还没变厉害，那就先变可爱一点。
          </p>
          <div className="about-tags" aria-label="我的关键词">
            <span>年终总结收藏家</span>
            <span>考试副本挑战中</span>
            <span>会爬山也会重启</span>
            <span>太阳能补电型选手</span>
          </div>
          <div className="about-social-links" aria-label="社交帐号">
            <a href="https://github.com/sssjack" target="_blank" rel="noreferrer">
              <Github size={18} /><span>GitHub</span>
            </a>
            <a href="https://www.zhihu.com/people/68505a0583a497cb4f7dc67fe37869d7" target="_blank" rel="noreferrer">
              <MessageCircle size={18} /><span>知乎</span>
            </a>
          </div>
        </div>
      </FadeIn>

      <ProfileAiChat navigate={navigate} />

      <FadeIn tag="section" className="content-band">
        <div className="section-head">
          <span>Featured</span>
          <h2>推荐文章</h2>
          <p>置顶那些值得反复回看的记录。</p>
        </div>
        <div className="article-grid">
          {recommended.map((article, i) => (
            <FadeIn key={article.id} delay={i * 100}>
              <ArticleCard article={article} navigate={navigate} featured />
            </FadeIn>
          ))}
          {recommended.length === 0 ? <EmptyState text="后台设置推荐文章后会显示在这里。" /> : null}
        </div>
      </FadeIn>

      <FadeIn tag="section" className="split-band">
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
      </FadeIn>

      <FadeIn tag="section" className="content-band timeline-band">
        <YearTimelineExperience navigate={navigate} compact />
      </FadeIn>

      <FadeIn tag="section" className="content-band">
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
      </FadeIn>

      <FadeIn>
        <MessageBoard initialMessages={data?.messages || []} />
      </FadeIn>
    </div>
  );
}

function ProfileAiChat({ navigate }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const streamTimers = useRef([]);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: '嗨，我会翻 Prince 已发布的文章来回答。文章里没写清楚的事，我会老实说不知道，再建议你问他本人。'
    }
  ]);

  useEffect(() => () => {
    streamTimers.current.forEach((timer) => window.clearTimeout(timer));
    streamTimers.current = [];
  }, []);

  function queueProfileStreamTick(callback, delay) {
    const timer = window.setTimeout(() => {
      streamTimers.current = streamTimers.current.filter((item) => item !== timer);
      callback();
    }, delay);
    streamTimers.current.push(timer);
  }

  function streamProfileAnswer(messageId, nextContent, sources = [], onDone = () => {}) {
    const fullAnswer = nextContent || PROFILE_CHAT_UNKNOWN;
    let cursor = 0;
    const chunkSize = fullAnswer.length > 120 ? 3 : 2;

    const reveal = () => {
      cursor = Math.min(fullAnswer.length, cursor + chunkSize);
      const done = cursor >= fullAnswer.length;
      const visibleContent = fullAnswer.slice(0, cursor);

      setMessages((current) => current.map((item) => (
        item.id === messageId
          ? {
            ...item,
            content: visibleContent,
            sources: done ? sources : [],
            loading: false,
            streaming: !done
          }
          : item
      )));

      if (done) {
        onDone();
        return;
      }

      const previousChar = fullAnswer[cursor - 1] || '';
      queueProfileStreamTick(reveal, /[。！？!?]/u.test(previousChar) ? 80 : 20);
    };

    reveal();
  }

  async function askProfile(nextQuestion = question) {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion || loading) return;
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanQuestion
    };
    const pendingId = `assistant-${Date.now()}`;
    setQuestion('');
    setLoading(true);
    setMessages((current) => [
      ...current,
      userMessage,
      { id: pendingId, role: 'assistant', content: '', loading: true }
    ]);

    try {
      const result = await api('/public/profile-chat', {
        method: 'POST',
        body: { question: cleanQuestion }
      });
      streamProfileAnswer(pendingId, result.answer || PROFILE_CHAT_UNKNOWN, result.sources || [], () => {
        setLoading(false);
      });
    } catch (error) {
      streamProfileAnswer(pendingId, error.message || 'AI 刚刚短暂掉线了，等一下再问我。', [], () => {
        setLoading(false);
      });
    }
  }

  function submit(event) {
    event.preventDefault();
    askProfile();
  }

  return (
    <FadeIn tag="section" className="content-band profile-chat-section" id="profile-chat">
      <div className="profile-chat-copy">
        <span className="about-kicker"><MessageCircle size={16} />Ask Prince AI</span>
        <h2>问问文章里的我</h2>
        <p>
          这里会优先阅读已发布文章和年终总结，再用轻快一点的语气回答。
          如果文章没有写到，我会直接说不知道。
        </p>
      </div>
      <div className="profile-chat-panel">
        <div className="profile-chat-messages" aria-live="polite">
          {messages.map((message) => (
            <article className={`profile-chat-message ${message.role}`} key={message.id}>
              <span>{message.role === 'user' ? '你' : 'PV'}</span>
              {message.loading ? (
                <div className="profile-chat-thinking" role="status" aria-label="AI 正在思考">
                  <span>正在翻文章</span>
                  <i />
                  <i />
                  <i />
                </div>
              ) : (
                <p>
                  {message.content}
                  {message.streaming ? <i className="profile-chat-caret" aria-hidden="true" /> : null}
                </p>
              )}
              {message.sources?.length ? (
                <div className="profile-chat-sources">
                  <small>参考文章</small>
                  {message.sources.map((source) => (
                    <button
                      type="button"
                      key={source.id || source.slug || source.title}
                      onClick={() => source.slug && navigate(`/article/${source.slug}`)}
                    >
                      {source.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <div className="profile-chat-suggestions" aria-label="推荐问题">
          {suggestedProfileQuestions.map((item) => (
            <button type="button" key={item} disabled={loading} onClick={() => askProfile(item)}>
              {item}
            </button>
          ))}
        </div>
        <form className="profile-chat-form" onSubmit={submit}>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="问一个关于 Prince 的问题"
            maxLength={500}
          />
          <button type="submit" aria-label="发送问题" disabled={loading || !question.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </FadeIn>
  );
}

function TimelinePage({ navigate }) {
  return (
    <section className="page-shell timeline-page">
      <YearTimelineExperience navigate={navigate} />
    </section>
  );
}

function YearTimelineExperience({ navigate, compact = false }) {
  const [selectedId, setSelectedId] = useState('');
  const { loading, error, data } = usePageData(() => api('/public/timeline'), []);
  const timeline = data?.timeline || { years: [], totalEvents: 0 };
  const insight = data?.insight || {};
  const visibleYears = useMemo(() => (
    compact
      ? timeline.years.slice(0, 3).map((group) => ({ ...group, events: group.events.slice(0, 6) }))
      : timeline.years
  ), [timeline.years, compact]);
  const flatEvents = useMemo(() => visibleYears.flatMap((group) => group.events), [visibleYears]);
  const activeEvent = flatEvents.find((event) => event.id === selectedId) || flatEvents[0] || null;

  useEffect(() => {
    if (!flatEvents.length) return;
    if (!selectedId || !flatEvents.some((event) => event.id === selectedId)) {
      setSelectedId(flatEvents[0].id);
    }
  }, [flatEvents, selectedId]);

  if (loading) return <Loading label="正在读取年终时间轴" />;
  if (error) return <ErrorView message={error} />;

  return (
    <div className={`timeline-experience ${compact ? 'compact' : 'full'}`}>
      <div className="section-head timeline-head">
        <span><Sparkles size={16} />Chronicle</span>
        <h2>时间轴</h2>
        <p>把每一篇年终总结拆成可回望的时间节点，让年月、选择和转折重新排成一条发光的路径。</p>
      </div>

      {flatEvents.length === 0 ? (
        <EmptyState text="年终总结文章里暂时没有可识别的时间节点。" />
      ) : (
        <div className="timeline-stage">
          <aside className="timeline-event-detail" aria-live="polite">
            {activeEvent ? (
              <>
                <div className="timeline-detail-kicker">
                  <Calendar size={16} />
                  <span>{activeEvent.dateLabel} / {activeEvent.year}</span>
                  {activeEvent.featured ? (
                    <span className="timeline-detail-badge"><Star size={13} />重点节点</span>
                  ) : null}
                </div>
                <h3>{activeEvent.title}</h3>
                <p>{activeEvent.detail}</p>
                <div className="timeline-detail-actions">
                  <button type="button" onClick={() => navigate(`/article/${activeEvent.articleSlug}`)}>
                    <FileText size={17} />
                    <span>阅读全文</span>
                  </button>
                  {compact ? (
                    <button type="button" onClick={() => navigate('/timeline')}>
                      <Clock3 size={17} />
                      <span>完整时间轴</span>
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </aside>

          <div className="timeline-constellation" aria-label="年终总结时间轴">
            {visibleYears.map((group, groupIndex) => (
              <section className="timeline-year-slice" key={group.year} style={{ '--year-index': groupIndex }}>
                <div className="timeline-year-mark">
                  <strong>{group.year}</strong>
                  <span>{group.events.length} 个节点</span>
                </div>
                <div className="timeline-events">
                  {group.events.map((event, eventIndex) => (
                    <button
                      type="button"
                      className={`timeline-event ${activeEvent?.id === event.id ? 'active' : ''} ${event.featured ? 'featured' : ''}`}
                      key={event.id}
                      aria-pressed={activeEvent?.id === event.id}
                      style={{ '--event-index': eventIndex }}
                      onClick={() => setSelectedId(event.id)}
                    >
                      <span className="timeline-event-meta">
                        <span className="timeline-event-date">{event.dateLabel}</span>
                        {event.featured ? <span className="timeline-event-badge"><Star size={12} />重点</span> : null}
                      </span>
                      <strong>{event.title}</strong>
                      <small>{event.precision === 'day' ? 'DAY' : 'PHASE'} · {event.articleTitle}</small>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <DeepSeekAnnualInsight insight={insight} />
    </div>
  );
}

function DeepSeekAnnualInsight({ insight }) {
  const ready = insight?.status === 'ready' && insight.overall;
  const blocks = [
    { key: 'strengths', title: '优点', items: insight?.strengths || [] },
    { key: 'weaknesses', title: '缺点', items: insight?.weaknesses || [] },
    { key: 'suggestions', title: '建议', items: insight?.suggestions || [] }
  ];

  return (
    <section className={`timeline-insight-panel ${ready ? 'ready' : 'pending'}`}>
      <div className="timeline-insight-orbit" aria-hidden="true" />
      <div className="timeline-insight-head">
        <span><Sparkles size={16} />DeepSeek Review</span>
        <h3>这些年终总结里的你</h3>
        <small>{ready ? `${insight.model || 'DeepSeek'} · ${formatDate(insight.updatedAt)}` : 'DeepSeek 正在读取这些年终总结'}</small>
      </div>
      {ready ? (
        <>
          <div className="timeline-insight-copy">
            <article>
              <span>对年终总结的评价</span>
              <p>{insight.overall}</p>
            </article>
            <article>
              <span>对个人的评价</span>
              <p>{insight.personalEvaluation}</p>
            </article>
          </div>
          <div className="timeline-insight-grid">
            {blocks.map((block) => (
              <article key={block.key}>
                <h4>{block.title}</h4>
                <ul>
                  {block.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="timeline-insight-pending">
          <div className="loader" />
          <p>{insight?.status === 'failed' ? 'DeepSeek 总评暂时生成失败，稍后会自动重试。' : '总评生成后会在这里展示：评价、个人画像、优点、缺点和建议。'}</p>
        </div>
      )}
    </section>
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
      <AiReviewBlock review={article.aiReview} />
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

function AiReviewBlock({ review }) {
  if (review?.status !== 'ready' || !review.content) return null;

  return (
    <section className="ai-review-block">
      <div className="ai-review-title">
        <Sparkles size={18} />
        <span>AI 点评</span>
      </div>
      <p>{review.content}</p>
      <small>{review.model || 'DeepSeek'} · {formatDate(review.updatedAt)}</small>
    </section>
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  function selectTab(key) {
    setTab(key);
    setMenuOpen(false);
  }

  if (loading) return <Loading label="正在进入后台" />;
  if (!user) return <LoginView onLogin={setUser} error={error} setError={setError} navigate={navigate} />;

  const tabs = [
    { key: 'analytics', Icon: BarChart3, label: '数据概览', hint: '访问、内容与地区' },
    { key: 'articles', Icon: FileText, label: '文章管理', hint: 'Markdown 与发布状态' },
    { key: 'categories', Icon: Layers, label: '分类管理', hint: '主题入口与归档' },
    { key: 'albums', Icon: Camera, label: '相册管理', hint: '照片、文件夹与时间线' },
    { key: 'messages', Icon: MessageSquare, label: '留言评论', hint: '回复访客互动' },
    { key: 'settings', Icon: Settings, label: '站点设置', hint: '首页文案与格言' }
  ];
  const activeTab = tabs.find((item) => item.key === tab) || tabs[0];

  return (
    <div className="admin-shell">
      <aside className={`admin-aside ${menuOpen ? 'is-open' : ''}`}>
        <div className="admin-aside-head">
          <button className="brand admin-brand" onClick={() => navigate('/')}>
            <span className="brand-mark">PV</span>
            <span>PrinceVlog</span>
          </button>
          <button className="admin-close" aria-label="关闭后台导航" onClick={() => setMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className={`admin-nav ${menuOpen ? 'is-open' : ''}`} aria-label="后台导航">
          {tabs.map(({ key, Icon, label, hint }) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => selectTab(key)}>
              <Icon size={18} />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="admin-user-panel">
          <div className="admin-avatar"><UserRound size={19} /></div>
          <div>
            <strong>{user.username}</strong>
            <span>Administrator</span>
          </div>
        </div>
        <IconButton icon={LogOut} className="ghost admin-logout" onClick={logout}>退出登录</IconButton>
      </aside>

      {menuOpen ? <button className="admin-scrim" aria-label="关闭后台导航" onClick={() => setMenuOpen(false)} /> : null}

      <div className="admin-workspace">
        <header className="admin-mobile-bar">
          <button className="admin-menu-toggle" aria-label="切换后台导航" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <div>
            <span>{activeTab.label}</span>
            <strong>PrinceVlog Admin</strong>
          </div>
          <button className="admin-home-button" aria-label="返回前台" onClick={() => navigate('/')}>
            <Home size={18} />
          </button>
        </header>

        <section className="admin-main">
          {tab === 'analytics' && <AdminAnalyticsPanel />}
          {tab === 'articles' && <AdminArticlesPanel />}
          {tab === 'categories' && <AdminCategoriesPanel />}
          {tab === 'albums' && <AdminAlbumsPanel />}
          {tab === 'messages' && <AdminEngagement />}
          {tab === 'settings' && <AdminSettings />}
        </section>
      </div>
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
        <div className="login-icon"><Shield size={24} /></div>
        <span>Admin Portal</span>
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
    <AdminSection title="数据概览" subtitle="请求量、访客、国家、省份和最近 50 条访问记录。">
      <div className="stats-grid">
        {cards.map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="admin-columns">
        <DataTable title="最近访问" rows={analytics.recentVisits} columns={['ip', 'country', 'province', 'path', 'createdAt']} />
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
              <span>{article.categoryName} · {article.status} · {article.recommended ? '推荐' : '普通'} · {article.aiReview?.status === 'ready' ? '已点评' : '待点评'}</span>
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

function AdminToolbar({ meta, children }) {
  return (
    <div className="admin-toolbar">
      <div>
        {meta ? <span>{meta}</span> : null}
      </div>
      <div className="admin-toolbar-actions">{children}</div>
    </div>
  );
}

function AdminModal({ open, title, subtitle, children, onClose, size = '' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" onMouseDown={onClose}>
      <div className={`admin-modal ${size}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="admin-modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="admin-modal-close" type="button" aria-label="关闭弹窗" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  );
}

function AdminAnalyticsPanel() {
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
    <AdminSection title="数据概览" subtitle="请求量、访客、国家、省份和最近 50 条访问记录。">
      <div className="stats-grid">
        {cards.map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="analytics-visual-grid">
        <AdminTrendChart rows={analytics.requestTrend || []} />
        <AdminBarChart title="省份访问排行" rows={(analytics.provinceStats || []).slice(0, 8)} labelKey="province" valueKey="count" />
        <ContentCompositionChart
          rows={[
            { label: '文章', value: analytics.articleCount, tone: 'primary' },
            { label: '照片', value: analytics.photoCount, tone: 'info' },
            { label: '留言', value: analytics.messageCount, tone: 'danger' }
          ]}
        />
      </div>

      <div className="admin-columns">
        <DataTable title="最近访问" rows={analytics.recentVisits || []} columns={['ip', 'country', 'province', 'path', 'createdAt']} />
        <DataTable title="热门路径" rows={analytics.topPaths || []} columns={['path', 'count']} />
      </div>
    </AdminSection>
  );
}

function AdminTrendChart({ rows }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.count || 0)));

  return (
    <div className="analytics-card trend-chart">
      <h3>近 7 天请求趋势</h3>
      <div className="trend-chart-bars">
        {rows.map((row) => {
          const height = Math.max(8, (Number(row.count || 0) / max) * 100);
          return (
            <div className="trend-chart-item" key={row.date}>
              <div className="trend-chart-track">
                <span style={{ height: `${height}%` }} />
              </div>
              <strong>{row.count}</strong>
              <small>{formatShortDate(row.date)}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminBarChart({ title, rows, labelKey, valueKey }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));

  return (
    <div className="analytics-card bar-chart">
      <h3>{title}</h3>
      <div className="bar-chart-list">
        {rows.map((row, index) => {
          const value = Number(row[valueKey] || 0);
          return (
            <div className="bar-chart-row" key={`${row[labelKey]}-${index}`}>
              <span>{row[labelKey]}</span>
              <div className="bar-chart-track">
                <i style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
              </div>
              <strong>{value}</strong>
            </div>
          );
        })}
        {rows.length === 0 ? <EmptyState text="暂无访问地区数据。" /> : null}
      </div>
    </div>
  );
}

function ContentCompositionChart({ rows }) {
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);

  return (
    <div className="analytics-card composition-chart">
      <h3>内容构成</h3>
      <div className="composition-stack" aria-label="内容构成小图表">
        {rows.map((row) => (
          <span key={row.label} className={`composition-${row.tone}`} style={{ width: `${total ? (row.value / total) * 100 : 33.33}%` }} />
        ))}
      </div>
      <div className="composition-list">
        {rows.map((row) => (
          <div key={row.label}>
            <span className={`composition-dot composition-${row.tone}`} />
            <strong>{row.value}</strong>
            <small>{row.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminArticlesPanel() {
  const empty = { title: '', subtitle: '', slug: '', coverUrl: '', categoryId: '', excerpt: '', content: '# 标题\n\n正文内容', recommended: false, status: 'published' };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState('');
  const [modalMode, setModalMode] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { loading, error, data } = usePageData(async () => {
    const [articles, categories] = await Promise.all([api('/admin/articles'), api('/admin/categories')]);
    return { articles: articles.articles, categories: categories.categories };
  }, [refresh]);
  const articles = data?.articles || [];
  const categories = data?.categories || [];

  function closeModal() {
    setModalMode('');
    setEditingId('');
    setForm(empty);
  }

  function openCreate() {
    setForm(empty);
    setEditingId('');
    setModalMode('create');
  }

  function openEdit(article) {
    setForm({ ...empty, ...article, categoryId: article.categoryId || '' });
    setEditingId(article.id);
    setModalMode('edit');
  }

  async function save(event) {
    event.preventDefault();
    await api(editingId ? `/admin/articles/${editingId}` : '/admin/articles', {
      method: editingId ? 'PUT' : 'POST',
      body: form
    });
    closeModal();
    setRefresh((value) => value + 1);
  }

  async function uploadCover(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const result = await api('/admin/uploads', { method: 'POST', body: fd });
    setForm((current) => ({ ...current, coverUrl: result.url }));
  }

  async function remove(id) {
    if (!window.confirm('确定删除这篇文章吗？')) return;
    await api(`/admin/articles/${id}`, { method: 'DELETE' });
    setRefresh((value) => value + 1);
  }

  if (loading) return <Loading label="正在加载文章列表" />;
  if (error) return <ErrorView message={error} />;

  return (
    <AdminSection title="文章管理" subtitle="默认先看列表，新增和编辑都在弹窗中完成。">
      <AdminToolbar meta={`${articles.length} 篇文章`}>
        <IconButton icon={Plus} onClick={openCreate}>新增文章</IconButton>
      </AdminToolbar>

      <div className="admin-list list-first">
        {articles.map((article) => (
          <div className="admin-row" key={article.id}>
            <div>
              <strong>{article.title}</strong>
              <span>{article.categoryName} · {article.status} · {article.recommended ? '推荐' : '普通'} · {article.aiReview?.status === 'ready' ? '已点评' : '待点评'}</span>
            </div>
            <div className="row-actions">
              <button type="button" aria-label="编辑文章" onClick={() => openEdit(article)}><Edit3 size={17} /></button>
              <button type="button" aria-label="删除文章" onClick={() => remove(article.id)}><Trash2 size={17} /></button>
            </div>
          </div>
        ))}
        {articles.length === 0 ? <EmptyState text="还没有文章，点击右上角新增。" /> : null}
      </div>

      <AdminModal open={Boolean(modalMode)} title={editingId ? '编辑文章' : '新增文章'} subtitle="标题、Slug、分类和正文可一次维护。" size="wide" onClose={closeModal}>
        <form className="admin-form admin-modal-form" onSubmit={save}>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="标题" required />
          <input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} placeholder="小标题" />
          <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="URL Slug" />
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
            <option value="">未分类</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
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
          <div className="modal-actions">
            <button className="admin-secondary-button" type="button" onClick={closeModal}>取消</button>
            <IconButton icon={Save}>{editingId ? '保存修改' : '新增文章'}</IconButton>
          </div>
        </form>
      </AdminModal>
    </AdminSection>
  );
}

function AdminCategoriesPanel() {
  const empty = { name: '', slug: '', description: '' };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState('');
  const [modalMode, setModalMode] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { loading, error, data } = usePageData(() => api('/admin/categories'), [refresh]);
  const categories = data?.categories || [];

  function closeModal() {
    setModalMode('');
    setEditingId('');
    setForm(empty);
  }

  function openCreate() {
    setForm(empty);
    setEditingId('');
    setModalMode('create');
  }

  function openEdit(category) {
    setForm({ ...empty, ...category });
    setEditingId(category.id);
    setModalMode('edit');
  }

  async function save(event) {
    event.preventDefault();
    await api(editingId ? `/admin/categories/${editingId}` : '/admin/categories', {
      method: editingId ? 'PUT' : 'POST',
      body: form
    });
    closeModal();
    setRefresh((value) => value + 1);
  }

  async function remove(id) {
    if (!window.confirm('确定删除这个分类吗？相关文章会变成未分类。')) return;
    await api(`/admin/categories/${id}`, { method: 'DELETE' });
    setRefresh((value) => value + 1);
  }

  if (loading) return <Loading label="正在加载分类列表" />;
  if (error) return <ErrorView message={error} />;

  return (
    <AdminSection title="分类管理" subtitle="默认展示分类列表，新增和编辑使用同一个弹窗。">
      <AdminToolbar meta={`${categories.length} 个分类`}>
        <IconButton icon={Plus} onClick={openCreate}>新增分类</IconButton>
      </AdminToolbar>

      <div className="admin-list list-first">
        {categories.map((category) => (
          <div className="admin-row" key={category.id}>
            <div><strong>{category.name}</strong><span>{category.slug} · {category.description || '暂无描述'}</span></div>
            <div className="row-actions">
              <button type="button" aria-label="编辑分类" onClick={() => openEdit(category)}><Edit3 size={17} /></button>
              <button type="button" aria-label="删除分类" onClick={() => remove(category.id)}><Trash2 size={17} /></button>
            </div>
          </div>
        ))}
        {categories.length === 0 ? <EmptyState text="还没有分类，点击右上角新增。" /> : null}
      </div>

      <AdminModal open={Boolean(modalMode)} title={editingId ? '编辑分类' : '新增分类'} subtitle="填写分类名、Slug 和描述。" onClose={closeModal}>
        <form className="admin-form admin-modal-form" onSubmit={save}>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="分类名称" required />
          <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Slug" />
          <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="描述" />
          <div className="modal-actions">
            <button className="admin-secondary-button" type="button" onClick={closeModal}>取消</button>
            <IconButton icon={Save}>{editingId ? '保存分类' : '新增分类'}</IconButton>
          </div>
        </form>
      </AdminModal>
    </AdminSection>
  );
}

function AdminAlbumsPanel() {
  const emptyAlbum = { title: '', folder: '', description: '', coverUrl: '' };
  const emptyPhoto = { albumId: '', title: '', caption: '', imageUrl: '', shotAt: new Date().toISOString().slice(0, 10) };
  const [albumForm, setAlbumForm] = useState(emptyAlbum);
  const [photoForm, setPhotoForm] = useState(emptyPhoto);
  const [editingAlbumId, setEditingAlbumId] = useState('');
  const [editingPhotoId, setEditingPhotoId] = useState('');
  const [modalMode, setModalMode] = useState('');
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const { loading, error, data } = usePageData(() => api('/admin/albums'), [refresh]);
  const albums = data?.albums || [];

  function closeModal() {
    setModalMode('');
    setAlbumForm(emptyAlbum);
    setPhotoForm((current) => ({ ...emptyPhoto, albumId: current.albumId }));
    setEditingAlbumId('');
    setEditingPhotoId('');
    setSelectedPhotoFiles([]);
  }

  function openAlbumCreate() {
    setAlbumForm(emptyAlbum);
    setEditingAlbumId('');
    setModalMode('album');
  }

  function openAlbumEdit(album) {
    setAlbumForm({ ...emptyAlbum, ...album });
    setEditingAlbumId(album.id);
    setModalMode('album');
  }

  function openPhotoCreate(albumId = photoForm.albumId) {
    setPhotoForm({ ...emptyPhoto, albumId: albumId || '' });
    setEditingPhotoId('');
    setSelectedPhotoFiles([]);
    setModalMode('photo');
  }

  function openPhotoEdit(photo) {
    setPhotoForm({ ...emptyPhoto, ...photo, albumId: photo.albumId || '' });
    setEditingPhotoId(photo.id);
    setSelectedPhotoFiles([]);
    setModalMode('photo');
  }

  async function saveAlbum(event) {
    event.preventDefault();
    await api(editingAlbumId ? `/admin/albums/${editingAlbumId}` : '/admin/albums', {
      method: editingAlbumId ? 'PUT' : 'POST',
      body: albumForm
    });
    closeModal();
    setRefresh((value) => value + 1);
  }

  function choosePhotoFiles(event) {
    const files = Array.from(event.target.files || []);
    setSelectedPhotoFiles(files.map((file) => ({
      file,
      title: titleFromFile(file.name),
      caption: ''
    })));
  }

  function updateSelectedPhoto(index, patch) {
    setSelectedPhotoFiles((files) => files.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  }

  async function uploadSinglePhoto(file) {
    const fd = new FormData();
    fd.append('file', file);
    return api('/admin/uploads', { method: 'POST', body: fd });
  }

  async function savePhoto(event) {
    event.preventDefault();
    if (editingPhotoId) {
      await api(`/admin/photos/${editingPhotoId}`, { method: 'PUT', body: photoForm });
    } else if (selectedPhotoFiles.length > 0) {
      await Promise.all(selectedPhotoFiles.map(async (item) => {
        const uploaded = await uploadSinglePhoto(item.file);
        return api('/admin/photos', {
          method: 'POST',
          body: {
            albumId: photoForm.albumId,
            shotAt: photoForm.shotAt,
            imageUrl: uploaded.url,
            title: item.title || titleFromFile(item.file.name),
            caption: item.caption
          }
        });
      }));
    } else {
      await api('/admin/photos', { method: 'POST', body: photoForm });
    }
    closeModal();
    setRefresh((value) => value + 1);
  }

  async function removeAlbum(id) {
    if (!window.confirm('确定删除这个相册吗？相册内照片也会删除。')) return;
    await api(`/admin/albums/${id}`, { method: 'DELETE' });
    setRefresh((value) => value + 1);
  }

  async function removePhoto(id) {
    if (!window.confirm('确定删除这张照片吗？')) return;
    await api(`/admin/photos/${id}`, { method: 'DELETE' });
    setRefresh((value) => value + 1);
  }

  if (loading) return <Loading label="正在加载相册列表" />;
  if (error) return <ErrorView message={error} />;

  return (
    <AdminSection title="相册管理" subtitle="默认查看相册和照片，新增内容从右上角进入弹窗。">
      <AdminToolbar meta={`${albums.length} 个相册`}>
        <IconButton icon={Folder} onClick={openAlbumCreate}>新增相册</IconButton>
        <IconButton icon={ImagePlus} onClick={() => openPhotoCreate()}>新增照片</IconButton>
      </AdminToolbar>

      <div className="admin-list album-list-first">
        {albums.map((album) => (
          <div className="album-admin" key={album.id}>
            <div className="album-admin-head">
              <div>
                <h3>{album.title}</h3>
                <p>{album.folder} · {album.description || '暂无描述'}</p>
              </div>
              <div className="row-actions">
                <button type="button" aria-label="给相册新增照片" onClick={() => openPhotoCreate(album.id)}><ImagePlus size={17} /></button>
                <button type="button" aria-label="编辑相册" onClick={() => openAlbumEdit(album)}><Edit3 size={17} /></button>
                <button type="button" aria-label="删除相册" onClick={() => removeAlbum(album.id)}><Trash2 size={17} /></button>
              </div>
            </div>
            <div className="photo-admin-list">
              {(album.photos || []).map((photo) => (
                <div className="photo-admin-row" key={photo.id}>
                  <img src={photo.imageUrl} alt={photo.title} />
                  <div>
                    <strong>{photo.title}</strong>
                    <span>{photo.shotAt} · {photo.caption || '暂无说明'}</span>
                  </div>
                  <div className="row-actions">
                    <button type="button" aria-label="编辑照片" onClick={() => openPhotoEdit(photo)}><Edit3 size={17} /></button>
                    <button type="button" aria-label="删除照片" onClick={() => removePhoto(photo.id)}><Trash2 size={17} /></button>
                  </div>
                </div>
              ))}
              {(album.photos || []).length === 0 ? <EmptyState text="这个相册还没有照片。" /> : null}
            </div>
          </div>
        ))}
        {albums.length === 0 ? <EmptyState text="还没有相册，点击右上角新增。" /> : null}
      </div>

      <AdminModal open={modalMode === 'album'} title={editingAlbumId ? '编辑相册' : '新增相册'} subtitle="填写相册名、文件夹标识、描述和封面。" onClose={closeModal}>
        <form className="admin-form admin-modal-form" onSubmit={saveAlbum}>
          <input value={albumForm.title} onChange={(event) => setAlbumForm({ ...albumForm, title: event.target.value })} placeholder="相册名" required />
          <input value={albumForm.folder} onChange={(event) => setAlbumForm({ ...albumForm, folder: event.target.value })} placeholder="文件夹标识" />
          <input value={albumForm.description} onChange={(event) => setAlbumForm({ ...albumForm, description: event.target.value })} placeholder="描述" />
          <input value={albumForm.coverUrl} onChange={(event) => setAlbumForm({ ...albumForm, coverUrl: event.target.value })} placeholder="封面 URL" />
          <div className="modal-actions">
            <button className="admin-secondary-button" type="button" onClick={closeModal}>取消</button>
            <IconButton icon={Save}>{editingAlbumId ? '保存相册' : '新增相册'}</IconButton>
          </div>
        </form>
      </AdminModal>

      <AdminModal open={modalMode === 'photo'} title={editingPhotoId ? '编辑照片' : '新增照片'} subtitle="可一次选择多张图片，并统一设置相册和日期。" size="wide" onClose={closeModal}>
        <form className="admin-form admin-modal-form" onSubmit={savePhoto}>
          <div className="photo-batch-top">
            <select value={photoForm.albumId} onChange={(event) => setPhotoForm({ ...photoForm, albumId: event.target.value })} required>
              <option value="">选择相册</option>
              {albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
            </select>
            <input type="date" value={photoForm.shotAt} onChange={(event) => setPhotoForm({ ...photoForm, shotAt: event.target.value })} />
            {!editingPhotoId ? (
              <label className="file-button"><ImagePlus size={17} />选择图片<input type="file" accept="image/*" multiple onChange={choosePhotoFiles} /></label>
            ) : null}
          </div>

          {selectedPhotoFiles.length > 0 ? (
            <div className="photo-batch-list">
              {selectedPhotoFiles.map((item, index) => (
                <div className="photo-batch-row" key={`${item.file.name}-${index}`}>
                  <span>{item.file.name}</span>
                  <input value={item.title} onChange={(event) => updateSelectedPhoto(index, { title: event.target.value })} placeholder="标题" />
                  <input value={item.caption} onChange={(event) => updateSelectedPhoto(index, { caption: event.target.value })} placeholder="说明" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <input value={photoForm.title} onChange={(event) => setPhotoForm({ ...photoForm, title: event.target.value })} placeholder="照片标题" required />
              <input value={photoForm.imageUrl} onChange={(event) => setPhotoForm({ ...photoForm, imageUrl: event.target.value })} placeholder="照片 URL" required />
              <input value={photoForm.caption} onChange={(event) => setPhotoForm({ ...photoForm, caption: event.target.value })} placeholder="说明" />
            </>
          )}

          <div className="modal-actions">
            <button className="admin-secondary-button" type="button" onClick={closeModal}>取消</button>
            <IconButton icon={Save}>{editingPhotoId ? '保存照片' : '新增照片'}</IconButton>
          </div>
        </form>
      </AdminModal>
    </AdminSection>
  );
}

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function titleFromFile(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim() || '未命名照片';
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
    <AdminSection title="站点设置" subtitle="首页标题、副标题和渐隐人生格言都在这里维护。">
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
              {columns.map((column) => <td key={column}>{column === 'createdAt' ? formatDateTime(row[column]) : row[column]}</td>)}
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
