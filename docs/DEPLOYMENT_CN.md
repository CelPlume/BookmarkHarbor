# BookmarkHarbor 部署指南

**构建并托管应用**

[English](DEPLOYMENT.md) | 中文

BookmarkHarbor 是一个静态单页应用。部署时先产出构建目录，再由任意静态主机托管。由于没有后端或数据库，因此数据层无需密钥、环境变量或基础设施。

## 开始之前

| 工具 | 版本 | 用途 |
| :--- | :--- | :--- |
| Node.js | 20.19 或更高，或 22.12 或更高 | 构建所需的 JavaScript 运行时 |
| [bun](https://bun.sh/) | 1.2 或更高 | 包管理器 |

可选：如果部署到 Cloudflare，需要 `wrangler`。

## 构建生产包

1. 安装依赖。

   ```sh
   bun install
   ```

2. 构建。

   ```sh
   bun run build
   ```

该命令执行 `tsc -b` 与 `vite build`，并将可部署站点输出到 `dist/`。部署前先在本地验证：

```sh
bun run preview
```

`vite preview` 会在本地 URL 提供 `dist/`。

## 部署到 Cloudflare（静态资源）

仓库包含 `wrangler.jsonc`，用于配置 Cloudflare 静态资源托管：

```jsonc
{
  "name": "bookmarkharbor",
  "compatibility_date": "2026-01-30",
  "assets": {
    "directory": "./dist"
  }
}
```

1. 按上述步骤构建项目。
2. 安装 `wrangler`（如果尚未安装）：

   ```sh
   bun add -d wrangler
   ```

3. 登录（一次性）：

   ```sh
   bunx wrangler login
   ```

4. 部署 `dist/` 资源：

   ```sh
   bunx wrangler deploy
   ```

由于这是一个纯静态应用，你也可以使用 `wrangler pages deploy dist` 部署到 Cloudflare Pages。两种方式都是在 Cloudflare 边缘提供构建后的资源。

## 部署到任意静态主机

因为 `dist/` 只包含静态文件，你可以在任意静态主机上提供服务：

- GitHub Pages：将 `dist/`（或在 CI 中构建）推送到 `gh-pages` 分支或使用 Pages 工作流。
- Vercel / Netlify：将构建命令设为 `bun run build`，输出目录设为 `dist`。
- 任意 Web 服务器（nginx、Apache、S3 + CloudFront）：将 `dist/` 的内容复制到文档根目录。

为 SPA 添加回退规则，使深层路由能解析到 `index.html`。BookmarkHarbor 是单视图应用，因此只有在主机重写未知路径时才需要该回退。

## 注意事项

- 应用将数据持久化在提供服务源的浏览器 `LocalStorage` 中。不同源（例如不同子域或通过 `file://` 打开）拥有各自独立、空白的 `LocalStorage`，因此用户会按源看到全新的书签库。
- `index.html` 会加载一个外部统计脚本。如果不需要统计，请在构建前删除该 `<script>` 标签。
- 没有服务端环境变量。版本号只记录在 `package.json` 中。

## 下一步

- [架构指南](ARCHITECTURE_CN.md)了解数据模型与领域模块。
- [开发指南](DEVELOPMENT_CN.md)了解规范与测试。
- [前端指南](UI_CN.md)了解视图、交互与设置。
