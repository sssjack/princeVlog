# PrinceVlog

PrinceVlog 是一个个人博客与照片相册网站，适合用来记录文章、旅行、生活影像、长期复盘和访客互动。项目同时提供前台展示和后台管理：访客可以阅读文章、浏览照片墙、留言评论；站长可以在后台维护文章、分类、相册、回复留言，并查看访问统计。

线上默认子路径为 `/princevlog/`，也可以通过环境变量调整部署路径。

## 项目特点

- **博客 + 相册一体化**：文章、分类、相册、照片墙和留言区整合在同一个站点中，适合个人内容沉淀。
- **Markdown 写作体验**：后台文章编辑支持 Markdown，前台自动渲染为安全的 HTML 内容。
- **可运营的后台管理**：文章发布、草稿、推荐、分类、相册、照片上传、评论回复和站点文案都能在后台维护。
- **访问统计内置**：服务端记录访问 IP、地区、路径和时间，后台提供请求量、访客数、今日访问、内容数量与省份排行。
- **文章知识 AI 问答**：首页可向 Prince AI 提问，系统会基于已发布文章和年度总结回答；找不到依据时会明确提示“不知道，建议问本人”。
- **响应式界面**：前台与后台均适配桌面端和移动端，后台在小屏幕下使用抽屉式导航。
- **轻量部署**：使用 React + Vite 构建静态前端，Express 提供 API、认证、上传和静态资源服务，PM2/Nginx 即可上线。

## 界面风格

前台偏内容展示，强调沉浸式首屏、文章卡片、分类入口、相册照片墙和留言互动。首页包含大图 Hero、滚动格言、推荐文章、最新文章、分类导航和相册预览。

后台采用轻量管理系统风格：

- 浅色磨砂侧栏、细边框卡片和中性色工作台面。
- 紫色作为主操作色，配合蓝、绿、橙、青、红等状态点缀。
- 数据卡片、表格、列表和表单保持紧凑，适合长期维护内容。
- 移动端顶部工具栏 + 侧栏抽屉，方便在手机上进行简单管理。
- 登录页使用深色玻璃面板，和后台主题保持一致。

## 功能清单

### 前台

- 首页站点标题、副标题和格言展示。
- 推荐文章和最新文章展示。
- 按分类筛选文章。
- 文章详情页，支持 Markdown 内容、阅读量和评论。
- 相册页，支持按文件夹或日期浏览照片。
- 首页留言板，访客可留言，后台可回复。
- 首页 About me 与 Ask Prince AI：支持个人介绍、社交账号入口、文章知识问答、思考动效和逐字流式展示。

### 后台

- 管理员登录与 Cookie 会话。
- 数据概览：请求量、访客数、今日请求、文章数、照片数、留言数。
- 访问记录表和省份排行。
- 文章新增、编辑、删除、发布状态、推荐状态、封面上传。
- 分类新增、编辑、删除。
- 相册创建、照片上传、照片删除。
- 评论和留言查看、回复、删除。
- 站点标题、作者、首页副标题和格言维护。

## 技术栈

### 前端

- **React 19**：构建前台页面和后台管理界面。
- **Vite 6**：开发服务器和生产构建。
- **lucide-react**：统一图标系统。
- **marked + DOMPurify**：Markdown 渲染与内容净化。
- **CSS 原生响应式布局**：不依赖大型 UI 框架，主题与动效集中在 `src/styles.css`。

### 后端

- **Express 4**：提供前台 API、后台 API、认证、上传和静态资源托管。
- **cookie-parser**：后台登录会话 Cookie。
- **multer**：图片上传。
- **geoip-lite**：IP 地区识别。
- **compression / cors**：压缩和跨域支持。
- **文件型数据存储**：默认使用 `data/data.json`，上传图片保存在 `data/uploads/`。
- **DeepSeek Chat API**：驱动首页个人知识问答，检索范围只包含已发布文章、摘要和 AI 复盘内容。

### 测试与部署

- **Vitest**：认证、数据存储、地区识别、时间轴、AI 问答知识库和主题结构测试。
- **PM2**：生产进程管理。
- **Nginx**：反向代理 `/princevlog/` 子路径到 Node 服务。

## 项目结构

```text
PrinceVlog/
|-- src/
|   |-- main.jsx        # React 前台、后台和路由入口
|   `-- styles.css      # 全站样式与后台主题
|-- server/
|   |-- index.js        # Express API、上传、静态资源和路由
|   |-- auth.js         # 管理员密码哈希与会话签名
|   |-- store.js        # 文件型数据读写
|   |-- geo.js          # IP 地区识别
|   `-- profileChat.js  # 文章知识库检索与 AI 问答
|-- tests/              # Vitest 测试
|-- data/               # 本地开发数据和上传文件
|-- dist/               # Vite 构建产物
|-- DEPLOYMENT.md       # 服务器部署说明
|-- package.json
`-- vite.config.js
```

## 本地运行

```bash
npm install
npm test
npm run build
npm start
```

默认访问地址：

- 前台：`http://127.0.0.1:4210/princevlog/`
- 后台：`http://127.0.0.1:4210/princevlog/admin`

本地开发也可以启动 Vite：

```bash
npm run dev
```

## 环境变量

生产环境建议通过环境变量配置后台账号、密码哈希、数据目录和会话密钥：

```bash
BASE_PATH=/princevlog
PORT=4210
DATA_DIR=/opt/princevlog/data
UPLOAD_DIR=/opt/princevlog/data/uploads
ADMIN_USER=root
ADMIN_PASSWORD_HASH='replace-with-scrypt-hash'
SESSION_SECRET='replace-with-long-random-string'
COOKIE_SECURE=false
DEEPSEEK_API_KEY='replace-with-api-key'
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
```

`DEEPSEEK_API_KEY` 用于首页 Ask Prince AI。如果没有配置，命中文章知识后接口会返回配置错误；如果问题没有命中文章知识，则会直接返回“不知道”的兜底回答，不会调用模型。

不要把真实服务器密码、后台明文密码、`SESSION_SECRET`、生产用 `ADMIN_PASSWORD_HASH` 或 `DEEPSEEK_API_KEY` 提交到 Git 仓库。完整部署流程见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 常用命令

```bash
# 运行测试
npm test

# 生产构建
npm run build

# 启动 Express 服务
npm start
```

## AI 问答知识库

首页 Ask Prince AI 的知识库来自当前已发布文章，包含标题、副标题、摘要、正文和后台生成的 AI 复盘内容。草稿不会进入公开知识库。

检索逻辑在 `server/profileChat.js` 中维护：

- 普通问题按中文 token、年份和文章内容打分召回。
- “这几年最大的变化是什么”“经历过哪些转折”等宽泛问题会额外扩展到年度总结、成长、复盘、秩序、信心、重新出发等语义。
- 没有可靠片段时，接口返回固定兜底文案，避免模型编造。

前端问答 UI 在 `src/main.jsx` 和 `src/styles.css` 中维护，包含推荐问题、思考小动效、逐字流式展示和参考文章跳转。

## 适合谁使用

PrinceVlog 适合想要一个轻量、可自己部署、又能长期维护内容的个人站点用户。它不是一个重型 CMS，更像是一个可以不断扩展的个人内容工作台：足够简单，方便部署；也足够完整，可以承担日常写作、图片归档和访客互动。
