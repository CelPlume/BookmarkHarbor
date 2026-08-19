# 书签浏览器开发指南

**本地搭建、代码规范、测试与提交约定**

[English](DEVELOPMENT.md) | 中文

本指南介绍为书签浏览器贡献代码的流程：环境搭建、脚本、代码规范、测试要求与提交约定。它假定你已经克隆了仓库。这是一个单一前端应用，所有工作都在仓库根目录的同一个包中进行。

## 开始之前

| 工具 | 版本 | 用途 |
| :--- | :--- | :--- |
| Node.js | 20.19 或更高，或 22.12 或更高 | 构建工具所需的 JavaScript 运行时（Vite 8 要求） |
| [bun](https://bun.sh/) | 1.2 或更高 | 包管理器与任务执行器 |

项目统一使用 `bun` 作为包管理器（`packageManager: bun@1.3.14`）。请勿混入 npm、pnpm 或 yarn 的锁文件。使用 `npm` 安装会产生不兼容的锁文件且不受支持（npm 12 与当前使用的 Node 22 运行时不兼容）。

## 本地开发环境搭建

1. 安装依赖。

   ```sh
   bun install
   ```

2. 启动开发服务器。

   ```sh
   bun run dev
   ```

Vite 开发服务器监听 `http://localhost:3000` 并自动打开浏览器。无需配置后端或数据库。

## 运行测试与检查

| 任务 | 命令 | 备注 |
| :--- | :--- | :--- |
| 测试套件 | `bun run test` | 在 `jsdom` 中运行一次 Vitest。 |
| 测试监听 | `bun run test:watch` | 变更时自动重跑。 |
| 测试覆盖率 | `bun run test:coverage` | 生成覆盖率报告。 |
| 类型检查 | `bun run lint` | 执行 `tsc --noEmit`。 |
| 构建 | `bun run build` | 执行 `tsc -b && vite build`，输出到 `dist/`。 |
| 预览 | `bun run preview` | 本地预览 `dist/` 构建产物。 |

测试套件在 `jsdom`（见 `vitest.config.ts`）中运行，`src/test/setup.ts` 提供 `localStorage` 与 `crypto.randomUUID` 的 mock。

## 代码规范

请遵循以下规范以保持代码库一致。

### 命名

- 文件：`kebab-case`
- React 组件：`PascalCase`
- 函数与变量：`camelCase`
- 常量：`UPPER_SNAKE_CASE`，对象引用也可用 PascalCase
- 类型与接口：`PascalCase`

### TypeScript

- 保持 `strict` 开启（`tsconfig.json` 设置了 `strict: true`）。
- 避免 `any`；确需使用时，加注释说明原因。
- 开启了 `noUnusedLocals` 与 `noUnusedParameters`，因此每次提交都必须能干净编译。
- 修改类型后运行 `bun run lint`。

### 导入顺序

按如下顺序组织导入：先外部库，再框架模块，再项目内部模块（`./core`、`./components`、`./i18n`），方便时将类型导入放在最后。

### 代码归属

- 无框架领域逻辑放在 `src/core/`，以便在没有 DOM 的情况下进行单元测试。
- React UI 放在 `src/components/`，使用 HeroUI（React Aria）组合式组件、Iconify 图标与 Tailwind CSS 样式。
- 不要引入第二套组件库或图标方案；项目统一使用 HeroUI 与 Iconify。
- 优先组合而非继承；保持组件粒度适中，不要把全部逻辑塞进单个页面组件。

### UI 一致性

- 遵循现有的视觉基线（颜色、间距、阴影与层级），不要另起炉灶。
- 任何组件改动都必须在浅色与深色主题下都可用。
- 在视图之间保持键盘与鼠标选择语义一致（单选、多选、范围、重命名、拖拽）。不要实现"看起来能用但规则不一致"的效果。

### 本地化

- 所有面向用户的文案都通过 `useTranslation` 取自 `src/i18n/translations/`。请同时为 `zh.ts` 与 `en.ts` 添加键。`en.ts` 以 `Translation` 类型作为类型依据，因此缺失的键会导致类型检查失败。

## 测试要求

当你修改 `src/core/` 模块时，在 `src/test/` 中添加测试。现有测试套件使用 Vitest：

| 文件 | 锁定内容 |
| :--- | :--- |
| `cycleDetection.test.ts` | 循环检测拒绝把文件夹移入自身或子孙；后代与祖先遍历。 |
| `orderKey.test.ts` | 排序键排序正确，并能在相邻之间插入（中点、增、减、批量）。 |
| `htmlParser.test.ts` | 将 Netscape 书签 HTML 解析为文件夹、书签、标签、备注与 URL。 |

修改相关代码时需要覆盖：

- **循环检测**：文件夹绝不能成为自己的祖先。添加多层级树的用例。
- **排序**：在任意相邻项之间插入必须得到能原位排序的键而不重写兄弟；批量生成必须保持单调。
- **导入解析**：格式错误或部分 HTML 不得抛错；文件夹与书签、属性、标签与嵌套备注必须能往返。

修改后运行 `bun run test`。不要为了通过测试而新增依赖；应通过 `src/test/setup.ts` mock 浏览器 API。

## 提交约定

使用约定式提交：`type(scope): subject`。当提交有实质正文时，优先使用多个 `-m` 参数，每个参数一条要点。

```sh
git commit -m "feat(ui): add draggable sidebar and inspector panel resizers" \
  -m "- 新增基于指针捕获的 PanelResizer 手柄。" \
  -m "- 将面板宽度持久化到 aurabookmarks_panel_widths。"
```

使用的类型与作用域如下。

| 类型 | 含义 |
| :--- | :--- |
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `docs` | 仅文档 |
| `style` | 格式化，无行为变化 |
| `refactor` | 无行为变化的代码改动 |
| `perf` | 性能优化 |
| `test` | 新增或修改测试 |
| `chore` | 维护 |

| 作用域 | 领域 |
| :--- | :--- |
| `i18n` | 翻译模块与键 |
| `settings` | 设置弹窗与默认视图行为 |
| `ui` | 组件与布局 |
| `file-browser` | 书签列表、卡片、选择工具栏 |
| `sidebar` | 侧边栏导航与品牌 |
| `inspector` | 属性面板 |
| `header` | 顶栏与搜索 |

保持每次提交聚焦一个模块。如果一次改动跨越多个模块，请拆分；这能让提交历史更易审阅，并与既有提交历史保持一致。

## 质量门槛清单

完成前请按以下清单检查每项改动。

- 工作区能编译：`bun run lint` 通过。
- 构建成功：`bun run build` 通过。
- 测试通过：`bun run test` 通过。当你修改 `src/core/` 时，添加一个在合理回归下会失败的测试。
- 无死代码、残留调试日志或注释掉的块。
- 新增的面向用户文案同时存在于 `zh.ts` 与 `en.ts`。
- UI 改动针对真实界面验证（运行应用或组件检查），并保持浅色与深色主题一致。
- 当结构、设置或约定变化时，同步更新文档引用。

## 常见坑

### 整文件 `git add` 没问题；拆分单个 hunk 很脆弱

仓库开启了 `noUnusedLocals` 与 `noUnusedParameters`。如果你把某个文件的改动拆分到多个提交，每个中间状态都必须能单独编译。优先一次性提交整个模块，或让相互依赖的导入与使用位于同一个提交中。

### LocalStorage 键

没有迁移就不要重命名 `aurabookmarks_data` 或 `aurabookmarks_panel_widths`。`loadFromStorage` 已经规范化了旧数据（例如把旧版 `grid` 视图映射为 `card`、裁剪列数），在演进 schema 时请保留该路径。

### 新增依赖

除非现有技术栈确实无法完成任务，否则不要添加依赖。项目统一使用 HeroUI、Iconify、Tailwind、Zod、i18next 与 `@dnd-kit`。新增 UI 组件库或图标库是被否决的模式；使用不熟悉的 API 前请查阅 Context7 文档。

### 提交前先类型检查

`lint` 以严格选项运行 `tsc --noEmit`。由于开启了 `noUnusedLocals`，未使用的导入或变量会导致检查失败并阻塞构建。

## 下一步

- [架构指南](ARCHITECTURE_CN.md)了解数据模型与领域模块。
- [前端设计指南](UI_CN.md)了解视图、交互与设置。
- [部署指南](DEPLOYMENT_CN.md)了解构建与托管。
