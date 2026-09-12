# PrinceVlog

一个用文字、影像和年度档案记录生活的个人网站。访客可以阅读故事、浏览相册和旅行记录，也可以通过 AI 问答了解公开文章中的经历；站长在后台维护内容、管理可见范围和导出备份。

## 在线访问

- [网站首页](http://www.clockwise.asia/princevlog/)
- [后台管理](http://www.clockwise.asia/princevlog/admin)
- [GitHub 仓库](https://github.com/sssjack/princeVlog)

所有页面和接口部署在 `/princevlog/` 子路径下。Nginx 将该路径转发给 Express，文章详情、年度档案等页面支持直接访问和刷新。

## 功能与页面

以下路径均相对于 `/princevlog/`。

| 页面 | 路径 | 功能 |
| --- | --- | --- |
| 首页 | `/` | 个人介绍、最新短记、真实内容统计、精选故事、最近更新、年度与相册预览；AI 问答和留言默认折叠 |
| 文章 | `/articles` | 关键词搜索标题、摘要及正文，支持年份与分类组合筛选 |
| 文章详情 | `/article/:slug` | Markdown、目录、阅读进度、预计阅读时间、恢复上次位置、上一篇／下一篇、评论与相关旅行 |
| 此刻 | `/moments` | 文字、可选图片和日期，按月份归档；最新一条展示在首页 |
| 年度档案 | `/years`、`/year/:year` | 年度主题、重要经历、关联文章、精选照片及“今天回看” |
| 时间轴 | `/timeline` | 从年终总结提取时间节点，阅读原文及展开年度 AI 复盘 |
| 相册 | `/gallery` | 按相册或日期浏览；`?album=相册ID` 直接进入对应相册 |
| 作品 | `/projects` | 展示作品目的、个人贡献、结果与访问链接 |
| 旅行 | `/trips`、`/trip/:id` | 将游记、相册和文章中的时间节点关联起来 |
| 关于我 | `/about` | 个人介绍、社交入口和作品预览 |
| 后台 | `/admin` | 内容维护、访问统计、工作副本、历史版本与数据备份 |

相册支持原比例大图、左右按钮、键盘方向键、手机横向滑动及 Escape 关闭。阅读位置保存在当前浏览器中，不会跨设备同步。

## 界面风格

默认采用暖白底色和鼠尾草绿点缀，可切换“抹茶奶白”“晴空蓝”“杏桃日光”三种浅色主题。

- 已移除全站背景照片墙，图片保留在文章和相册内容中。
- 年度与技术文章采用统一文字封面，其他文章优先展示已有图片；原封面数据保留。
- 手机端正文为 17px，目录默认折叠，常用导航提供更大的点击区域；后台入口位于页脚。
- AI 评价采用摘要与展开阅读，区分文字依据、观察和建议。
- 后台提供移动端抽屉导航。

## 后台使用

### 发布文章与生活记录

1. 登录后台，在“文章管理”维护长文章、分类、归档年份与封面。
2. 在“生活内容”中选择“此刻短记”“年度档案”“作品与折腾”或“旅行故事”。
3. 添加真实内容，按需关联文章、相册或精选照片。
4. 确认需要对外展示时，将可见范围设为“公开”，状态设为“发布”，然后保存。

新建文章与生活记录默认是**私密草稿**，新相册默认私密。旧文章和相册保持升级前的公开状态。私密记录可在后台查看与编辑。

已有年终总结会自动生成年度入口。每年可以补充一份年度档案，填写主题、精选影像和新的回看感受。将该年度档案设为私密或草稿后，其年度档案页面不公开；关联文章和相册仍分别遵守各自的可见范围。

没有短记时，首页展示“一句话”格言。作品、短记与旅行等新增栏目需要自行添加内容，不自动填充示例记录。

### 自动保存与修改历史

- 编辑文章或生活记录，停顿约 0.9 秒后自动保存独立工作副本，**不会改变已发布内容**。
- 再次进入编辑器时，可以选择恢复未完成的工作副本。
- 文章每次明确保存修改时保留上一版本，最多保留 50 版。
- 点击“载入此版本”先恢复到编辑器，再点击保存才正式生效。
- 网络异常时编辑器会提示自动保存失败，请保留编辑页面并重试。

### 备份与恢复

后台“数据备份”下载 `.tar.gz`，包含：

- `data.json`：文章、分类、相册信息、短记、年度档案、作品、旅行、评论、私密内容、工作副本和文章修改历史等数据。
- `uploads/`：服务器本地上传的原始照片，包括子目录。

仅登录管理员可以导出备份。备份不包含 `.env` 环境密钥，也不会下载外部图片源站的文件。

恢复时先停止服务并备份当前数据，将导出的 `data.json` 放回 `DATA_DIR`，照片放回 `UPLOAD_DIR`，保留原有环境配置后重新启动。不要通过覆盖整个发布目录来替代数据恢复。

## 可见范围与 AI

公开接口仅返回已发布且公开的文章、生活记录，以及公开相册。搜索、文章详情、日期分组、年度档案、旅行关联、时间轴和 AI 知识库统一遵守可见范围。

- AI 问答只使用公开且已发布的文章、摘要及已有复盘内容，草稿与私密文章不进入知识库。
- 后台 AI 点评不发送私密内容；年度评价和时间轴标题缓存会检查来源，避免内容隐藏后继续返回不匹配的缓存。
- 找不到可靠依据时，问答会提示未找到信息；找到依据但未配置 AI 密钥时，会返回配置错误。
- 访客只能访问被公开内容引用的上传文件，管理员登录后可查看私密图片。Nginx 必须将上传路径转发给 Node 服务，不能用静态 `alias` 绕过校验。
- 已经被下载或缓存的公开图片无法追溯撤回；外部图片地址的访问权限由图片源站决定。

AI 配置统一由 `server/aiConfig.js` 读取，默认模型为 `gpt-5.6-luna`，实际使用的服务地址、密钥和模型均可通过环境变量配置。

## 技术与目录

前端使用 React 19、Vite 6、lucide-react、marked 与 DOMPurify；后端使用 Express 4、Cookie 会话、multer 和文件型数据存储。生产服务由 PM2 管理，Nginx 提供域名和子路径转发。

```text
PrinceVlog/
├── src/
│   ├── main.jsx           # 路由、原有页面、文章编辑与后台入口
│   ├── features.jsx       # 生活档案、搜索、相册、阅读工具与新后台功能
│   ├── styles.css         # 基础样式与后台主题
│   ├── public.css         # 浅色主题与公共页面
│   └── features.css       # 新内容页面和交互样式
├── server/
│   ├── index.js           # API、登录、上传鉴权与静态资源服务
│   ├── store.js           # JSON 存储、内容读写、工作副本与历史
│   ├── content.js         # 可见范围、年份和内容字段规范化
│   ├── library.js         # 生活档案接口与备份导出
│   ├── auth.js            # 管理员认证与会话签名
│   ├── profileChat.js     # 公开文章知识问答
│   ├── aiReview.js        # 文章点评
│   ├── timeline.js        # 年度时间节点
│   ├── timelineInsight.js # 年度 AI 复盘
│   └── timelineTitles.js  # 时间节点标题
├── data/                  # 本地数据与上传文件，不提交
├── dist/                  # 生产构建产物，不提交
├── tests/                 # 本地测试；新增和修改的测试不提交
├── .env.example           # 环境变量示例，使用前按环境修改
├── DEPLOYMENT.md          # 详细部署说明
├── package.json
└── vite.config.js
```

## 本地运行

先安装依赖：

```bash
npm ci
```

在项目根目录创建 `.env`。本地示例使用相对数据路径；请填写自己的登录密码和会话密钥：

```dotenv
BASE_PATH=/princevlog
PORT=4210
DATA_DIR=./data
UPLOAD_DIR=./data/uploads
ADMIN_USER=root
ADMIN_PASSWORD=replace-with-your-local-password
SESSION_SECRET=replace-with-your-local-session-secret
COOKIE_SECURE=false
APIYI_LLM_API_KEY=
APIYI_LLM_MODEL=gpt-5.6-luna
APIYI_LLM_API_URL=https://api.apiyi.com/v1/chat/completions
```

构建并启动：

```bash
npm run build
npm start
```

访问 [本地前台](http://127.0.0.1:4210/princevlog/) 或 [本地后台](http://127.0.0.1:4210/princevlog/admin)。开发时保持后端运行，在另一个终端执行 `npm run dev`，通过 [Vite 开发页面](http://127.0.0.1:5177/princevlog/)访问；Vite 将 API 和上传请求代理到 `4210` 端口。

服务端读取 `BASE_PATH`，前端路径由 `vite.config.js` 的 `base` 决定。修改部署子路径时，必须同步修改前端 base、开发代理、服务端环境变量和 Nginx 配置，并重新构建。

## 生产部署

当前服务端已在 Node 16.20.2 与 PM2 环境验证，前端在本地构建后上传 `dist/`。这不表示前端构建工具可以使用同样的 Node 版本；构建环境需满足锁定依赖的运行要求。

```text
/opt/princevlog/
├── current -> releases/<版本>/
├── releases/              # 独立发布目录，包含代码和 dist
├── backups/               # 上线前的数据、照片和配置备份
└── data/                  # 所有版本共用的持久化数据
    ├── data.json
    └── uploads/
```

生产环境使用 `DATA_DIR=/opt/princevlog/data`、`UPLOAD_DIR=/opt/princevlog/data/uploads` 和 `PORT=4210`。在服务器私有 `.env` 中配置 `ADMIN_PASSWORD_HASH`、`SESSION_SECRET` 和可选 AI 密钥，部署时沿用，不放入 Git 或公开发布包。当前站点为 HTTP，因此 `COOKIE_SECURE=false`；启用 HTTPS 后再同步调整。

域名现有 server 块中的转发配置：

```nginx
location = /princevlog {
    return 301 /princevlog/;
}

location ^~ /princevlog/ {
    proxy_pass http://127.0.0.1:4210;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
}
```

发布流程：校验代码和构建 → 提交推送 → 备份数据与照片 → 上传独立发布目录 → 保留私有配置与持久化数据路径 → 切换 `current` → 重启 `princevlog` → 检查域名、API、图片和后台鉴权。验证失败时切回上一个发布目录。

详细配置及命令见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 验证说明

最近一次功能升级在本地通过 19 个测试文件、83 项测试和生产构建；服务器 Node 16 + PM2 隔离实例验证了内容增删改查、组合搜索、工作副本、历史版本、图片鉴权和备份恢复。页面及公开 API 可通过正式域名访问。

测试文件按项目约定仅保留本地；已有本地测试时运行 `npm test`。从仓库检出的历史测试可能不包含本地新增验证，不能据此假定能够复现完整的 83 项测试。浏览器工具此前连接失败，尚未完成实机截图视觉核验。
