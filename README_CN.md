<div align="center">

<img src="public/favicon.svg" alt="BookmarkHarbor 图标" width="96" height="96" />

# BookmarkHarbor

**文件管理器风格、完全本地存储、界面现代美观、支持多语言的书签浏览器**

[English](README.md) | 中文

开源 · 本地优先 · 隐私安全 · 现代界面 · 多语言（中 / 英）

</div>

## 概述

BookmarkHarbor 以文件管理器的方式管理你的书签：它使用文件夹、选择、拖拽排序和标准编辑快捷键，让你无需学习新的操作习惯就能整理大型书签库。所有数据都保存在浏览器的 LocalStorage 中，不会发送到任何服务器，从而保证书签收藏的隐私与离线可用。

这是一个由 React 和 Vite 构建的单页前端应用，没有后端，也没有账号体系。

## 开始之前

| 工具 | 版本 | 用途 |
| :--- | :--- | :--- |
| Node.js | 20.19 或更高，或 22.12 或更高 | Vite 8 所需的 JavaScript 运行时 |
| [bun](https://bun.sh/) | 1.2 或更高 | 包管理器与任务执行器 |

本项目统一使用 `bun` 作为包管理器，请勿混入 npm、pnpm 或 yarn 的锁文件。

## 本地开发环境搭建

1. 安装依赖。

   ```sh
   bun install
   ```

2. 启动开发服务器。

   ```sh
   bun run dev
   ```

开发服务器会自动打开浏览器并访问 `http://localhost:3000`。应用完全在浏览器内运行，无需配置数据库或服务器。

## 运行测试与检查

| 任务 | 命令 |
| :--- | :--- |
| 运行测试套件 | `bun run test` |
| 类型检查 | `bun run lint`（执行 `tsc --noEmit`） |
| 构建生产包 | `bun run build`（执行 `tsc -b && vite build`） |
| 预览构建结果 | `bun run preview` |

## 功能总览

| 领域 | 亮点 |
| :--- | :--- |
| 文件管理器式交互 | 单选、多选、Shift 范围选择、双击打开、内联重命名。 |
| 视图 | 卡片 / 列表 / 平铺三种视图，可选按文件夹记忆视图。 |
| 拖拽 | 同级排序、跨文件夹移动、拖到侧边栏文件夹，含循环检测。 |
| 属性面板 | 编辑标题、URL、颜色、封面与图标；从 URL 抓取元信息与图标。 |
| 视觉组织 | 主题色、单项颜色、封面与图标。 |
| 过滤视图 | 收藏夹 / 稍后阅读 / 回收站，支持软删除与恢复。 |
| 历史记录 | 常见编辑与批量操作的撤销 / 重做。 |
| 导入 / 导出 | Netscape HTML 书签格式，支持多文件导入与三种导出范围。 |
| 国际化 | 中英文，可运行时切换。 |
| 本地持久化 | 数据全部保存在 LocalStorage，无服务器、无账号。 |

## 数据存储

- 存储后端：`LocalStorage`。
- 主键：`aurabookmarks_data`（JSON，带版本号）。
- 面板宽度：`aurabookmarks_panel_widths`（侧边栏与属性面板的像素宽度）。
- 回收站使用软删除；删除的项目进入回收站，可恢复或彻底删除。
- 清除数据：可在设置中找到，需经确认对话框；会清空 `localStorage` 中的全部键并把书签库重置为默认。

默认设置为：`locale: zh`、`theme: system`、`viewMode: card`、`themeColor: #3B82F6`、`singleClickAction: select`。全部选项见[设置](docs/UI_CN.md#设置)。

## 导入与导出

- 导入支持一个或多个 `.html` / `.htm` Netscape 书签文件（每个不超过 5 MB）。
- 每个导入的文件会生成一个以文件名命名的文件夹（去掉扩展名）。
- 导出支持三种范围：整个书签库、当前文件夹、或当前选择。
- 上传的封面与图标限制为 200 KB（png / jpeg / webp / svg）。

## 项目结构

```
BookmarkHarbor/
├── index.html               # 应用外壳、meta 标签、统计脚本
├── public/favicon.svg        # 品牌标志
├── src/
│   ├── main.tsx              # 入口文件
│   ├── providers.tsx         # HeroUI Toast Provider
│   ├── App.tsx               # 应用外壳、状态与编排
│   ├── components/           # React UI 组件
│   ├── core/                 # 无框架领域逻辑与 hooks
│   ├── i18n/                 # i18next 资源（zh、en）
│   ├── styles/index.css      # Tailwind 4、HeroUI 样式、主题变量
│   └── test/                 # Vitest 单元测试
├── docs/                     # 文档（英文 + 中文）
├── vite.config.ts            # Vite 8（Rolldown）配置
├── vitest.config.ts          # Vitest 配置
├── wrangler.jsonc            # Cloudflare Pages / 静态资源配置
└── package.json
```

## 文档

| 指南 | 内容 |
| :--- | :--- |
| [架构](docs/ARCHITECTURE_CN.md) | 数据模型、领域模块、状态、设计决策、主题。 |
| [开发指南](docs/DEVELOPMENT_CN.md) | 本地搭建、脚本、代码规范、测试、提交约定。 |
| [前端指南](docs/UI_CN.md) | 视图、布局、交互、键盘快捷键、设置、无障碍。 |
| [部署指南](docs/DEPLOYMENT_CN.md) | 生产构建、Cloudflare Pages、静态托管。 |

每份指南都提供英文版本：`docs/*.md`。

## 下一步

- 阅读[架构指南](docs/ARCHITECTURE_CN.md)了解数据模型与领域模块。
- 按照上述步骤配置本地环境。
- 查阅[前端指南](docs/UI_CN.md)了解交互规则与设置。
