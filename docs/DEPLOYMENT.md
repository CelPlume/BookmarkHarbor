# BookmarkHarbor deployment guide

**Build and host the application**

English | [中文](DEPLOYMENT_CN.md)

BookmarkHarbor is a static single-page application. Deployment produces a build output directory and serves it from any static host. Because there is no backend or database, there are no secrets, environment variables, or infrastructure to provision for the data layer.

## Before you begin

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| Node.js | 20.19 or later, or 22.12 or later | JavaScript runtime for building |
| [bun](https://bun.sh/) | 1.2 or later | Package manager |

Optional: `wrangler` if you deploy to Cloudflare.

## Build the production bundle

1. Install the dependencies.

   ```sh
   bun install
   ```

2. Build.

   ```sh
   bun run build
   ```

The command runs `tsc -b` and `vite build` and emits the deployable site into `dist/`. Verify locally before you deploy:

```sh
bun run preview
```

`vite preview` serves `dist/` at a local URL.

## Deploy to Cloudflare (static assets)

The repository includes `wrangler.jsonc`, which configures Cloudflare static-asset hosting:

```jsonc
{
  "name": "bookmarkharbor",
  "compatibility_date": "2026-01-30",
  "assets": {
    "directory": "./dist"
  }
}
```

1. Build the project as described above.
2. Install `wrangler` if you have not:

   ```sh
   bun add -d wrangler
   ```

3. Authenticate (once):

   ```sh
   bunx wrangler login
   ```

4. Deploy the `dist/` assets:

   ```sh
   bunx wrangler deploy
   ```

Because the app is a purely static site, you can also use `wrangler pages deploy dist` for Cloudflare Pages. Either path serves the built assets on the Cloudflare edge.

## Deploy to any static host

Because `dist/` contains only static files, you can serve it from any static host:

- GitHub Pages: push `dist/` (or build in CI) to a `gh-pages` branch or use a Pages workflow.
- Vercel / Netlify: set the build command to `bun run build` and the output directory to `dist`.
- Any web server (nginx, Apache, S3 + CloudFront): copy the contents of `dist/` to the document root.

Add a SPA fallback so deep routes resolve to `index.html`. BookmarkHarbor is a single view, so a fallback is only needed for hosts that rewrite unknown paths.

## Notes

- The app persists data in the browser's `LocalStorage` for the origin that serves it. A different origin (for example, a different subdomain or a `file://` open) has a separate, empty `LocalStorage`, so users see a fresh library per origin.
- `index.html` loads an external analytics script. If you do not want analytics, remove that `<script>` tag before building.
- There are no server-side environment variables. Track version bumps in `package.json` only.

## What's next

- [Architecture guide](ARCHITECTURE.md) for the data model and domain modules.
- [Development guide](DEVELOPMENT.md) for conventions and testing.
- [Frontend guide](UI.md) for views, interactions, and settings.
