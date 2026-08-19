<div align="center">

<img src="public/favicon.svg" alt="BookmarkHarbor logo" width="96" height="96" />

# BookmarkHarbor

**A file-manager-style, local-first bookmark browser with a modern UI and multilingual support**

English | [中文](README_CN.md)

Open-source · Local-first · Privacy-safe · Modern UI · Multilingual (zh / en)

</div>

## Overview

BookmarkHarbor manages your bookmarks the way a file manager manages files. It uses folders, selection, drag-and-drop reordering, and standard editing shortcuts so you can organize a large library without learning a new paradigm. All data stays in your browser's LocalStorage; nothing is sent to a server, which keeps your bookmark collection private and offline.

The application is a single-page front end built with React and Vite. It has no backend and no account system.

## Before you begin

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| Node.js | 20.19 or later, or 22.12 or later | JavaScript runtime required by Vite 8 |
| [bun](https://bun.sh/) | 1.2 or later | Package manager and task runner |

This project uses `bun` as its single package manager. Do not mix npm, pnpm, or yarn lockfiles into the repository.

## Set up for local development

1. Install the dependencies.

   ```sh
   bun install
   ```

2. Start the development server.

   ```sh
   bun run dev
   ```

The dev server starts with your browser open at `http://localhost:3000`. The application runs entirely in the browser, so you do not need to set up a database or server.

## Run the tests and checks

| Task | Command |
| :--- | :--- |
| Run the test suite | `bun run test` |
| Type check | `bun run lint` (runs `tsc --noEmit`) |
| Build for production | `bun run build` (runs `tsc -b && vite build`) |
| Preview the production build | `bun run preview` |

## Feature overview

| Area | Highlights |
| :--- | :--- |
| File-manager interaction | Single select, multi-select, Shift range select, double-click to open, inline rename. |
| Views | Card, list, and tile views with per-folder view memory (optional). |
| Drag and drop | Reorder within a folder, move across folders, drop onto sidebar folders, with cycle detection. |
| Inspector | Edit title, URL, color, cover, and icon; fetch metadata and favicon from the URL. |
| Visual organization | Theme color, per-item color, covers, and icons. |
| Filtered views | Favorites, Read Later, and Trash with soft-delete and restore. |
| History | Undo and redo for common edits and bulk actions. |
| Import / Export | Netscape HTML bookmark import (multi-file) and export (all, folder, or selection). |
| Internationalization | Chinese and English, switchable at runtime. |
| Local-first persistence | Everything stays in LocalStorage; no server or account. |

## Data storage

- Storage backend: `LocalStorage`.
- Primary key: `aurabookmarks_data` (JSON, versioned).
- Panel widths: `aurabookmarks_panel_widths` (sidebar and inspector width in pixels).
- Trash uses soft-delete; deleted items move to Trash and you can restore or hard-delete them.
- Clear data: available from Settings behind a confirmation dialog; it wipes every key in `localStorage` and resets the library to defaults.

The default settings are: `locale: zh`, `theme: system`, `viewMode: card`, `themeColor: #3B82F6`, `singleClickAction: select`. See [settings](docs/UI.md#settings) for every option.

## Import and export

- Import accepts one or more `.html`/`.htm` Netscape bookmark files (limit 5 MB each).
- Each imported file becomes a folder named after the file (extension removed).
- Export supports three scopes: the whole library, the current folder, or the current selection.
- The upload limit for covers and icons is 200 KB (png, jpeg, webp, svg).

## Project structure

```
BookmarkHarbor/
├── index.html               # App shell, meta tags, analytics script
├── public/favicon.svg        # Brand mark
├── src/
│   ├── main.tsx              # Entry point
│   ├── providers.tsx         # HeroUI Toast provider
│   ├── App.tsx               # App shell, state, orchestration
│   ├── components/           # React UI components
│   ├── core/                 # Framework-free domain logic and hooks
│   ├── i18n/                 # i18next resources (zh, en)
│   ├── styles/index.css      # Tailwind 4, HeroUI styles, theme variables
│   └── test/                 # Vitest unit tests
├── docs/                     # Documentation (English + 中文)
├── vite.config.ts            # Vite 8 (Rolldown) configuration
├── vitest.config.ts          # Vitest configuration
├── wrangler.jsonc            # Cloudflare Pages / static assets config
└── package.json
```

## Documentation

| Guide | Contents |
| :--- | :--- |
| [Architecture](docs/ARCHITECTURE.md) | Data model, domain modules, state, design decisions, theming. |
| [Development guide](docs/DEVELOPMENT.md) | Local setup, scripts, code conventions, testing, commit convention. |
| [Frontend guide](docs/UI.md) | Views, layout, interactions, keyboard shortcuts, settings, accessibility. |
| [Deployment guide](docs/DEPLOYMENT.md) | Production build, Cloudflare Pages, and static hosting. |

Each guide has a Chinese version: `docs/*_CN.md`.

## What's next

- Read the [architecture guide](docs/ARCHITECTURE.md) to understand the data model and domain modules.
- Set up a local environment with the steps above.
- Review the [frontend guide](docs/UI.md) for interaction rules and settings.
