# BookmarkHarbor development guide

**Local setup, conventions, testing, and commit rules**

English | [中文](DEVELOPMENT_CN.md)

This guide covers contributing to BookmarkHarbor: environment setup, scripts, code conventions, testing expectations, and the commit convention. It assumes you have a working clone of the repository. The application is a single front end, so all work happens in one package rooted at the repository.

## Before you begin

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| Node.js | 20.19 or later, or 22.12 or later | JavaScript runtime for build tooling (Vite 8 requirement) |
| [bun](https://bun.sh/) | 1.2 or later | Package manager and task runner |

The project uses `bun` as its single package manager (`packageManager: bun@1.3.14`). Do not mix npm, pnpm, or yarn lockfiles into the repository. Installing with `npm` produces an incompatible lockfile and is not supported (npm 12 is incompatible with the Node 22 runtime in use).

## Set up a local environment

1. Install the dependencies.

   ```sh
   bun install
   ```

2. Start the development server.

   ```sh
   bun run dev
   ```

The Vite dev server listens on `http://localhost:3000` and opens your browser automatically. There is no backend or database to configure.

## Run tests and checks

| Task | Command | Notes |
| :--- | :--- | :--- |
| Test suite | `bun run test` | Runs Vitest once in `jsdom`. |
| Test watch | `bun run test:watch` | Re-runs on change. |
| Test coverage | `bun run test:coverage` | Generates a coverage report. |
| Type check | `bun run lint` | Runs `tsc --noEmit`. |
| Build | `bun run build` | Runs `tsc -b && vite build`, emitting to `dist/`. |
| Preview | `bun run preview` | Serves the `dist/` build locally. |

The test suite runs in `jsdom` (see `vitest.config.ts`) with `src/test/setup.ts` providing `localStorage` and `crypto.randomUUID` mocks.

## Code conventions

Follow these conventions so the codebase stays consistent.

### Naming

- Files: `kebab-case`
- React components: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` or PascalCase for object references
- Types and interfaces: `PascalCase`

### TypeScript

- Keep `strict` mode enabled (`tsconfig.json` sets `strict: true`).
- Avoid `any`; if you must use it, add a comment that explains why.
- The `tsconfig.json` enables `noUnusedLocals` and `noUnusedParameters`, so every commit must compile cleanly.
- Run `bun run lint` after you change types.

### Import order

Order imports as follows: external libraries first, then framework modules, then project-internal modules (`./core`, `./components`, `./i18n`), with type-only imports last where convenient.

### Where code lives

- Framework-free domain logic goes in `src/core/` so it can be unit-tested without a DOM.
- React UI goes in `src/components/` using HeroUI (React Aria) compound components, Iconify for icons, and Tailwind CSS for styling.
- Do not introduce a second component library or icon set; the project standardizes on HeroUI and Iconify.
- Prefer composition over inheritance, and keep component granularity moderate. Do not push all logic into a single page component.

### UI consistency

- Follow the existing visual baseline (colors, spacing, shadows, and elevation) rather than inventing a new look.
- Any component change must remain usable in both light and dark themes.
- Keep keyboard and mouse selection semantics consistent across views (single, multi, range, rename, drag). Do not ship an interaction that "looks usable" but applies different rules.

### Localization

- All user-facing strings come from `src/i18n/translations/` via `useTranslation`. Add keys to both `zh.ts` and `en.ts`. `en.ts` uses the `Translation` type as its contract, so a missing key fails the type check.

## Testing requirements

Add tests in `src/test/` when you change a `src/core/` module. The existing suite uses Vitest:

| File | What it locks in |
| :--- | :--- |
| `cycleDetection.test.ts` | Cycle detection refuses moving a folder into itself or a descendant; descendant and ancestor traversal. |
| `orderKey.test.ts` | Order keys sort correctly and insert between neighbors (midpoint, increment, decrement, bulk runs). |
| `htmlParser.test.ts` | Parses Netscape bookmark HTML into folders, bookmarks, tags, notes, and URLs. |

Cover the following when you change related code:

- **Cycle detection**: a folder must never be its own ancestor. Add cases that walk multi-level trees.
- **Ordering**: inserting between any two neighbors must yield a key that sorts in place without rewriting siblings; bulk key generation must stay monotonic.
- **Import parsing**: malformed or partial HTML must not throw; folders and bookmarks, attributes, tags, and nested notes must round-trip.

Run `bun run test` after changes. Do not add dependencies to make tests pass; mock browser APIs through `src/test/setup.ts` instead.

## Commit convention

Use Conventional Commits: `type(scope): subject`. When the change has a meaningful body, prefer multiple `-m` flags, each flag one bullet point.

```sh
git commit -m "feat(ui): add draggable sidebar and inspector panel resizers" \
  -m "- Add a PanelResizer handle using pointer capture." \
  -m "- Persist panel widths to aurabookmarks_panel_widths."
```

Use these types and scopes.

| Type | Meaning |
| :--- | :--- |
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no behavior change |
| `refactor` | Code change with no behavior change |
| `perf` | Performance improvement |
| `test` | Test additions or changes |
| `chore` | Maintenance |

| Scope | Area |
| :--- | :--- |
| `i18n` | Translation modules and keys |
| `settings` | Settings modal and default-view behavior |
| `ui` | Components and layout |
| `file-browser` | Bookmark list, cards, selection toolbar |
| `sidebar` | Sidebar navigation and branding |
| `inspector` | Property panel |
| `header` | Top bar and search |

Keep each commit focused on one module. If a change spans modules, split it; this keeps history reviewable and matches the existing commit history.

## Quality gates checklist

Review each change against this checklist before you finish.

- The working tree compiles: `bun run lint` passes.
- The build succeeds: `bun run build` passes.
- Tests pass: `bun run test` passes. Add a test that fails on a plausible regression when you change `src/core/`.
- No dead code, leftover debug logging, or commented-out blocks.
- New user-facing strings exist in both `zh.ts` and `en.ts`.
- Verify UI changes against the actual surface (run the app or a component check) and keep them consistent in light and dark themes.
- Update documentation references when you change structure, settings, or conventions.

## Common pitfalls

### `git add` the whole file is fine; staging single hunks is brittle

The repository keeps `noUnusedLocals` and `noUnusedParameters` on. If you split a file's changes across commits, each intermediate state must compile on its own. Prefer committing a whole module at a time, or keep dependent imports and usages in the same commit.

### LocalStorage keys

Do not rename `aurabookmarks_data` or `aurabookmarks_panel_widths` without a migration. `loadFromStorage` already normalizes older data (for example, mapping legacy `grid` view to `card` and clamping column counts), so preserve that path when you evolve the schema.

### Adding dependencies

Do not add a package unless the existing stack cannot do the job. The project standardizes on HeroUI, Iconify, Tailwind, Zod, i18next, and `@dnd-kit`. New UI or icon libraries are a rejected pattern; check `Context7` documentation before using an unfamiliar API.

### Type check before commit

`lint` runs `tsc --noEmit` with strict options. Because `noUnusedLocals` is on, an unused import or variable fails the check and blocks the build.

## What's next

- [Architecture guide](ARCHITECTURE.md) for the data model and domain modules.
- [Frontend design guide](UI.md) for views, interactions, and settings.
- [Deployment guide](DEPLOYMENT.md) for building and hosting.
