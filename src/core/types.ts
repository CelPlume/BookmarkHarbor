/**
 * BookmarkHarbor 核心类型定义
 */

// 节点类型
export type NodeType = 'folder' | 'bookmark';

// 封面类型
export type CoverType = 'none' | 'uploaded' | 'remote' | 'generated';

// 图标来源
export type IconSource = 'favicon' | 'user' | 'apple-touch' | 'other';

// 基础节点接口
export interface Node {
    id: string;
    type: NodeType;
    parentId: string | null;
    title: string;
    url?: string; // 仅 bookmark
    orderKey: string; // 排序键（LexoRank 风格）
    color?: string; // hex 颜色
    coverUrl?: string;
    coverType?: CoverType;
    coverAssetId?: string;
    iconUrl?: string;
    iconAssetId?: string;
    iconSource?: IconSource;
    notes?: string;
    tags?: string[];
    isFavorite?: boolean;
    isReadLater?: boolean;
    createdAt: number; // Unix timestamp (ms)
    updatedAt: number;
    deletedAt?: number | null; // 软删除
}

// 创建节点请求
export type CreateNodeRequest =
    | { type: 'folder'; parentId: string; title: string; orderKey?: string }
    | { type: 'bookmark'; parentId: string; title: string; url: string; orderKey?: string };

// 更新节点请求
export interface UpdateNodeRequest {
    title?: string;
    url?: string;
    color?: string;
    coverUrl?: string;
    coverType?: CoverType;
    coverAssetId?: string;
    iconUrl?: string;
    iconAssetId?: string;
    iconSource?: IconSource;
    notes?: string;
    tags?: string[];
    isFavorite?: boolean;
    isReadLater?: boolean;
}

// 移动节点请求
export interface MoveNodesRequest {
    nodeIds: string[];
    toParentId: string;
    beforeId?: string; // 插到某节点之前
    afterId?: string;  // 插到某节点之后
}

// 删除节点请求
export interface DeleteNodesRequest {
    nodeIds: string[];
    hard?: boolean; // 是否硬删除
}

// 资源（封面/图标上传）
export interface Asset {
    id: string;
    kind: 'cover' | 'icon';
    mime: string;
    storageKey: string; // base64 data URL 或文件路径
    sizeBytes: number;
    width?: number;
    height?: number;
    sha256?: string;
    createdAt: number;
}

// URL 元信息缓存
export interface UrlMetadataCache {
    url: string;
    title?: string;
    description?: string;
    ogImageUrl?: string;
    bestIconUrl?: string;
    icons?: Array<{ url: string; sizes?: string; type?: string; rel?: string }>;
    fetchedAt: number;
}

// 元信息抓取响应
export interface MetadataResponse {
    url: string;
    title?: string;
    description?: string;
    ogImageUrl?: string;
    icons: Array<{ url: string; sizes?: string; type?: string; rel?: string }>;
    bestIconUrl?: string;
}

// 导入 HTML 响应
export interface ImportHtmlResult {
    fileName: string;
    importRootId: string;
    created: number;
    skipped: number;
    errors: string[];
}

// 导出范围
export type ExportScope = 'all' | 'folder' | 'selection';

// 排序字段
export type SortField = 'default' | 'title' | 'updatedAt' | 'createdAt' | 'type';

// 排序顺序
export type SortOrder = 'asc' | 'desc';

// 视图模式
export type ViewMode = 'list' | 'card' | 'tile';

// 卡片文件夹预览尺寸
export type CardFolderPreviewSize = '2x2' | '3x3' | '4x3';

// 单击行为
export type SingleClickAction = 'select' | 'open';

// 主题
export type Theme = 'light' | 'dark' | 'system';

// 语言
export type Locale = 'zh' | 'en';

// 应用状态
export interface AppState {
    // 导航
    currentFolderId: string;
    breadcrumbs: Array<{ id: string; title: string }>;

    // 选择
    selectedIds: Set<string>;
    anchorId: string | null; // 用于 Shift 范围选择

    // UI
    sidebarOpen: boolean;
    inspectorOpen: boolean;
    viewMode: ViewMode;
    theme: Theme;
    locale: Locale;

    // 搜索
    searchQuery: string;
    searchScope: 'all' | 'current';

    // 展开的文件夹（侧边栏）
    expandedFolders: Set<string>;
}

// 自动整理规则的匹配条件（全部满足才算命中，未填写的条件不参与判断）
export interface RuleCondition {
    /** 域名包含该子串，如 "github.com" */
    domainContains?: string;
    /** 标题匹配该正则（已编译校验，长度受限） */
    titleRegex?: string;
    /** 网址匹配该正则 */
    urlRegex?: string;
    /** 创建时间早于该时间戳（Unix ms） */
    createdBefore?: number;
    /** 创建时间晚于该时间戳 */
    createdAfter?: number;
    /** 含有其中任意一个标签 */
    tagIn?: string[];
}

// 命中规则后要执行的动作（未填写的动作不执行）
export interface RuleAction {
    /** 移动到指定文件夹 */
    moveToFolderId?: string;
    /** 追加这些标签（与已有标签取并集） */
    addTags?: string[];
    /** 标记为收藏 */
    setFavorite?: boolean;
    /** 标记为稍后阅读 */
    setReadLater?: boolean;
}

// 自动整理规则
export interface AutoOrganizeRule {
    id: string;
    /** 规则名称，仅用于界面展示 */
    name: string;
    enabled: boolean;
    /** 优先级，数值小的先匹配 */
    priority: number;
    /** 命中后是否继续匹配后续规则；false 表示首个命中即停止 */
    continueMatching?: boolean;
    when: RuleCondition;
    then: RuleAction;
    createdAt: number;
    updatedAt: number;
}

// 规则匹配预览：一条规则将影响哪些节点、做什么
export interface RuleMatchDetail {
    ruleId: string;
    ruleName: string;
    nodeIds: string[];
}

// 整批整理的预览结果
export interface OrganizePreview {
    /** 将被修改的节点总数（去重后） */
    affectedCount: number;
    /** 移动的节点数 */
    moveCount: number;
    /** 新增标签的节点数 */
    tagCount: number;
    /** 收藏 / 稍后阅读标记数 */
    flagCount: number;
    /** 按规则分组的明细 */
    details: RuleMatchDetail[];
    /** 字段更新（标签、标记），直接走 updateNode */
    patches: Array<{ id: string; patch: UpdateNodeRequest }>;
    /** 移动（单列，因为移动走 moveNodes 而不是字段更新） */
    moves: Array<{ id: string; toFolderId: string }>;
}

// 持久化存储结构
export interface StorageData {
    version: number;
    nodes: Record<string, Node>;
    assets: Record<string, Asset>;
    metadataCache: Record<string, UrlMetadataCache>;
    rules: AutoOrganizeRule[];
    settings: {
        theme: Theme;
        locale: Locale;
        viewMode: ViewMode;
        sidebarOpen: boolean;
        autoExpandTree: boolean;
        cardFolderPreviewSize: CardFolderPreviewSize;
        customColors: string[];
        defaultViewMode: ViewMode;
        rememberFolderView: boolean;
        folderViewModes: Record<string, ViewMode>;
        themeColor: string;
        singleClickAction: SingleClickAction;
        cardColumnsDesktop: number;
        cardColumnsMobile: number;
        tileColumnsDesktop: number;
        tileColumnsMobile: number;
    };
}

// 初始化存储数据
export const DEFAULT_STORAGE_DATA: StorageData = {
    version: 2,
    nodes: {
        root: {
            id: 'root',
            type: 'folder',
            parentId: null,
            title: 'All Bookmarks',
            orderKey: 'a0',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
    },
    assets: {},
    metadataCache: {},
    rules: [],
    settings: {
        theme: 'system',
        locale: 'zh',
        viewMode: 'card',
        sidebarOpen: true,
        autoExpandTree: false,
        cardFolderPreviewSize: '2x2',
        customColors: [],
        defaultViewMode: 'card',
        rememberFolderView: false,
        folderViewModes: {},
        themeColor: '#3B82F6',
        singleClickAction: 'select',
        cardColumnsDesktop: 4,
        cardColumnsMobile: 2,
        tileColumnsDesktop: 4,
        tileColumnsMobile: 2,
    },
};
