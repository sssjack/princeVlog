# PrinceVlog

PrinceVlog 是一个个人博客与相册网站，包含官网风格首页、文章分类、Markdown 文章、相册照片墙、留言板、评论回复和后台统计。

## 本地运行

```bash
npm install
npm test
npm run build
npm start
```

默认访问路径为 `http://127.0.0.1:4210/princevlog/`，后台为 `http://127.0.0.1:4210/princevlog/admin`。

生产环境请通过 `ADMIN_PASSWORD_HASH` 或 `ADMIN_PASSWORD` 配置后台密码，不要把真实密码提交进仓库。
