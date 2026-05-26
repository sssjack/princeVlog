# PrinceVlog 部署文档

本文档记录 PrinceVlog 从本地开发、推送仓库到服务器上线的完整流程。当前线上访问路径为：

- 前台：`http://www.clockwise.asia/princevlog/`
- 后台：`http://www.clockwise.asia/princevlog/admin`
- API：`http://www.clockwise.asia/princevlog/api`

> 安全提醒：不要把服务器密码、后台密码、`SESSION_SECRET` 或真实 `ADMIN_PASSWORD` 写入 Git 仓库。生产环境优先使用 `ADMIN_PASSWORD_HASH`。

## 1. 项目结构

```text
PrinceVlog/
|-- dist/              # Vite 构建后的前端静态文件，生产启动前必须存在
|-- server/            # Express 服务端，负责 API、后台登录、上传、访问统计
|-- src/               # React 前端源码
|-- data/              # 本地开发数据，生产环境建议放到 /opt/princevlog/data
|-- package.json
|-- .env.example
`-- DEPLOYMENT.md
```

线上建议目录：

```text
/opt/princevlog/
|-- app/               # Git 拉取的项目代码
`-- data/              # 生产数据和上传图片，部署更新时不要删除
    |-- data.json
    `-- uploads/
```

## 2. 本地开发与构建

在本地项目根目录执行：

```bash
cd /path/to/PrinceVlog
npm install
npm test
npm run build
npm start
```

本地默认访问：

- `http://127.0.0.1:4210/princevlog/`
- `http://127.0.0.1:4210/princevlog/admin`

如果修改了代码，提交前建议至少跑：

```bash
npm test
npm run build
```

## 3. 推送到 GitHub

```bash
git status
git add .
git commit -m "docs: update deployment guide"
git push origin main
```

仓库地址：

```text
https://github.com/sssjack/princeVlog.git
```

## 4. 服务器首次部署

以下命令在服务器上执行。示例以 Ubuntu/Debian 系统为准。

### 4.1 安装基础环境

```bash
apt update
apt install -y git nginx curl

# 安装 Node.js，建议使用 Node 20 LTS 或更新的 LTS 版本
node -v
npm -v

# 安装 PM2
npm install -g pm2
```

如果服务器还没有 Node.js，建议用 NodeSource、nvm 或系统包管理器安装 Node 20 LTS。

### 4.2 拉取项目

```bash
mkdir -p /opt/princevlog
cd /opt/princevlog
git clone https://github.com/sssjack/princeVlog.git app
cd /opt/princevlog/app
```

### 4.3 安装依赖并构建

```bash
npm ci
npm test
npm run build
```

`dist/` 目录生成成功后，Express 才能正确返回前端页面。

### 4.4 配置生产环境变量

在 `/opt/princevlog/app/.env` 写入生产配置。示例：

```bash
BASE_PATH=/princevlog
PORT=4210
DATA_DIR=/opt/princevlog/data
UPLOAD_DIR=/opt/princevlog/data/uploads
ADMIN_USER=root
ADMIN_PASSWORD_HASH='replace-with-scrypt-hash'
SESSION_SECRET='replace-with-long-random-string'
COOKIE_SECURE=false
```

如果后续启用 HTTPS，可以把 `COOKIE_SECURE` 改为 `true`。

注意：当前项目代码不会自动读取 `.env` 文件，使用 PM2 启动或重启前需要先把 `.env` 导入当前 shell 环境。

生成后台密码哈希的方式：

```bash
cd /opt/princevlog/app
node --input-type=module -e "import { hashPassword } from './server/auth.js'; console.log(await hashPassword(process.argv[1]));" '<your-admin-password>'
```

把输出的 `scrypt$...` 填到 `ADMIN_PASSWORD_HASH`。不要把明文密码写进仓库。

### 4.5 创建数据目录

```bash
mkdir -p /opt/princevlog/data/uploads
```

生产数据默认保存在：

```text
/opt/princevlog/data/data.json
/opt/princevlog/data/uploads/
```

这两个路径是博客文章、分类、相册、评论、留言、访问统计和上传图片的核心数据，更新部署时必须保留。

### 4.6 使用 PM2 启动服务

```bash
cd /opt/princevlog/app
set -a
. ./.env
set +a
pm2 start server/index.js --name princevlog --update-env
pm2 save
pm2 startup
```

检查服务：

```bash
pm2 status
pm2 logs princevlog
curl -I http://127.0.0.1:4210/princevlog/
curl http://127.0.0.1:4210/princevlog/api/public/bootstrap
```

## 5. Nginx 子路径代理

PrinceVlog 运行在 `/princevlog` 子路径下，Nginx 必须保留这个路径前缀转发给 Node 服务。

在站点配置中加入：

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

    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

注意：`proxy_pass http://127.0.0.1:4210;` 后面不要加 `/`，否则可能会把 `/princevlog` 前缀重写掉。

检查并重载 Nginx：

```bash
nginx -t
systemctl reload nginx
```

## 6. 上线验证

部署完成后依次检查：

```bash
curl -I http://www.clockwise.asia/princevlog/
curl -I http://www.clockwise.asia/princevlog/admin
curl http://www.clockwise.asia/princevlog/api/public/bootstrap
```

浏览器访问：

- `http://www.clockwise.asia/princevlog/`
- `http://www.clockwise.asia/princevlog/admin`

后台登录后检查：

- 文章管理是否能新增、编辑、删除
- 分类管理是否正常
- 相册上传和照片墙是否正常
- 评论、留言回复是否正常
- 访问统计是否记录请求量、访客 IP、省份和时间

## 7. 后续更新部署

本地完成开发并推送到 GitHub 后，服务器执行：

```bash
cd /opt/princevlog/app
git pull --ff-only origin main
npm ci
npm test
npm run build
set -a
. ./.env
set +a
pm2 restart princevlog --update-env
```

验证：

```bash
pm2 status
curl -I http://127.0.0.1:4210/princevlog/
curl -I http://www.clockwise.asia/princevlog/
```

如果只是更新文章、相册、分类、留言回复等内容，不需要重新部署代码，直接在后台操作即可。

## 8. 数据备份与恢复

备份：

```bash
mkdir -p /opt/princevlog/backups
tar -czf /opt/princevlog/backups/princevlog-data-$(date +%F-%H%M%S).tar.gz -C /opt/princevlog data
```

恢复前先停止服务：

```bash
pm2 stop princevlog
tar -xzf /opt/princevlog/backups/<backup-file>.tar.gz -C /opt/princevlog
pm2 start princevlog
```

建议在每次代码部署前、批量导入文章或相册前备份一次。

## 9. 常用维护命令

```bash
# 查看进程
pm2 status

# 查看日志
pm2 logs princevlog

# 重启服务，先导入生产环境变量
cd /opt/princevlog/app
set -a
. ./.env
set +a
pm2 restart princevlog --update-env

# 停止服务
pm2 stop princevlog

# 查看 Nginx 状态
systemctl status nginx

# 检查 Nginx 配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

## 10. 常见问题

### 页面返回 404 或前端空白

确认 `npm run build` 已生成 `dist/`，并检查 PM2 日志：

```bash
ls -la /opt/princevlog/app/dist
pm2 logs princevlog
```

### `/princevlog/api` 不通

确认 Node 服务正在监听 `4210`：

```bash
pm2 status
curl http://127.0.0.1:4210/princevlog/api/public/bootstrap
```

如果本机能访问、域名不能访问，重点检查 Nginx 的 `location ^~ /princevlog/` 配置。

### 后台无法登录

检查 `.env` 中：

- `ADMIN_USER`
- `ADMIN_PASSWORD_HASH` 或 `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `COOKIE_SECURE`

如果当前是 HTTP 访问，`COOKIE_SECURE` 应为 `false`。

### 上传图片后不显示

确认上传目录存在且服务有写入权限：

```bash
mkdir -p /opt/princevlog/data/uploads
ls -la /opt/princevlog/data/uploads
```

同时确认 Nginx 没有拦截 `/princevlog/uploads/`，该路径应转发到 Node 服务。
