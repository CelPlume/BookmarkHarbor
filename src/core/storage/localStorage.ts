/**
 * LocalStorage 存储适配器
 */

import type {
    Node,
    Asset,
    UrlMetadataCache,
    StorageData,
    CreateNodeRequest,
    UpdateNodeRequest,
    MoveNodesRequest,
    DeleteNodesRequest,
    Theme,
    Locale,
    ViewMode,
    AutoOrganizeRule,
} from '../types';
import { generateId } from '../utils';
import { generateOrderKey, generateOrderKeys } from '../orderKey';
import { detectCycleForMultiple } from '../cycleDetection';

const STORAGE_KEY = 'aurabookmarks_data';
const CURRENT_VERSION = 2;

/**
 * 版本迁移表：从版本 N 升到 N+1 的转换函数
 *
 * 每条迁移只负责相邻两个版本之间的差异，逐级执行。
 * 新增字段、改结构、改语义都写在这里，而不是散落在 loadFromStorage 里。
 */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {
    // v1 -> v2：新增规则化自动整理所需的 rules 字段
    1: (data) => {
        if (!Array.isArray(data.rules)) {
            data.rules = [];
        }
        return data;
    },
};

/**
 * 读取存储里记录的版本号
 *
 * 与 loadFromStorage 分开：调用方只想知道"盘上是什么版本"，
 * 不需要跑完整解析。读不到或格式不对时返回 null，表示无从判断。
 */
function readStoredVersion(): number | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { version?: unknown };
        return typeof parsed.version === 'number' ? parsed.version : null;
    } catch {
        return null;
    }
}

/**
 * 把数据从 fromVersion 逐级升到 CURRENT_VERSION
 *
 * 缺失的迁移步骤按原样跳过，不阻断加载——宁可让用户拿到缺字段的数据
 * （后续读取处都有默认值兜底），也不该因为迁移失败就整份数据打不开。
 * 版本号高于当前程序（用户降级）时同样不动数据。
 */
function runMigrations(data: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
    // 版本高于当前程序（用户降级）时保持原样，不擅自改写
    if (fromVersion > CURRENT_VERSION) return data;

    let migrated = data;
    for (let v = fromVersion; v < CURRENT_VERSION; v += 1) {
        const migration = MIGRATIONS[v];
        if (!migration) continue;
        try {
            migrated = migration(migrated);
        } catch (error) {
            console.error(`迁移 v${v} -> v${v + 1} 失败:`, error);
        }
    }

    // 统一落到当前版本号：v1 跑完迁移后要写成 v2，
    // 数据里根本没有 version 字段时也要补上
    return { ...migrated, version: CURRENT_VERSION };
}

/**
 * 获取默认存储数据
 */
function getDefaultData(): StorageData {
    return {
        version: CURRENT_VERSION,
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
}

/**
 * 从 LocalStorage 读取数据
 */
export function loadFromStorage(): StorageData {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return getDefaultData();
        }

        const data = JSON.parse(raw) as StorageData & Record<string, unknown>;
        const defaults = getDefaultData();

        // 先跑版本迁移，再补默认值——迁移可能需要新增字段，
        // 顺序反了会让迁移拿不到它期望的结构
        const dataVersion = typeof data.version === 'number' ? data.version : CURRENT_VERSION;
        const migrated = runMigrations(data as unknown as Record<string, unknown>, dataVersion) as unknown as StorageData;
        Object.assign(data, migrated);

        // 兼容旧版本缺失字段
        data.settings = {
            ...defaults.settings,
            ...(data.settings ?? {}),
        };

        // 校验并修正设置值
        if (data.settings.singleClickAction !== 'select' && data.settings.singleClickAction !== 'open') {
            data.settings.singleClickAction = defaults.settings.singleClickAction;
        }

        const clampSetting = (value: unknown, min: number, max: number, fallback: number) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return fallback;
            return Math.min(max, Math.max(min, Math.round(numeric)));
        };

        const legacyGridColumns = Number((data.settings as { gridColumns?: unknown }).gridColumns);
        if (Number.isFinite(legacyGridColumns)) {
            if (data.settings.cardColumnsDesktop === undefined) {
                data.settings.cardColumnsDesktop = clampSetting(legacyGridColumns, 2, 9, defaults.settings.cardColumnsDesktop);
            }
            if (data.settings.tileColumnsDesktop === undefined) {
                data.settings.tileColumnsDesktop = clampSetting(legacyGridColumns, 1, 7, defaults.settings.tileColumnsDesktop);
            }
        }
        delete (data.settings as { gridColumns?: unknown }).gridColumns;

        data.settings.cardColumnsDesktop = clampSetting(
            data.settings.cardColumnsDesktop,
            2,
            9,
            defaults.settings.cardColumnsDesktop
        );
        data.settings.cardColumnsMobile = clampSetting(
            data.settings.cardColumnsMobile,
            1,
            4,
            defaults.settings.cardColumnsMobile
        );
        data.settings.tileColumnsDesktop = clampSetting(
            data.settings.tileColumnsDesktop,
            1,
            7,
            defaults.settings.tileColumnsDesktop
        );
        data.settings.tileColumnsMobile = clampSetting(
            data.settings.tileColumnsMobile,
            1,
            2,
            defaults.settings.tileColumnsMobile
        );

        // 视图模式迁移：'grid' -> 'card'
        if ((data.settings as { viewMode?: unknown }).viewMode === 'grid') {
            data.settings.viewMode = 'card';
        }

        // 缺失的 rules 兜底（老数据经迁移后应为空数组）
        if (!Array.isArray(data.rules)) {
            data.rules = [];
        }

        return data;
    } catch (error) {
        console.error('Failed to load from storage:', error);
        return getDefaultData();
    }
}

/**
 * 保存数据到 LocalStorage
 */
export function saveToStorage(data: StorageData): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save to storage:', error);
        throw new Error('存储失败，可能是存储空间已满');
    }
}

/**
 * 存储适配器类
 */
export class StorageAdapter {
    private data: StorageData;
    private listeners: Set<() => void> = new Set();

    constructor() {
        this.data = loadFromStorage();

        // 迁移只改内存是不够的：不写回的话每次打开都要重跑一遍，
        // 版本号也永远停在旧值上。这里把迁移结果落盘一次。
        const storedVersion = readStoredVersion();
        if (storedVersion !== null && storedVersion < CURRENT_VERSION) {
            try {
                saveToStorage(this.data);
            } catch (error) {
                // 写不进去（空间不足等）不影响本次使用，内存里已是新版本
                console.error('迁移结果未能写回存储:', error);
            }
        }
    }

    /**
     * 订阅数据变化
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * 通知所有监听器
     */
    private notify(): void {
        this.listeners.forEach(listener => listener());
    }

    /**
     * 保存并通知
     */
    private save(): void {
        // Ensure new references so React state updates reliably.
        // We intentionally keep Node objects immutable at the map level, and refresh map references on every save.
        this.data = {
            ...this.data,
            nodes: { ...this.data.nodes },
            assets: { ...this.data.assets },
            metadataCache: { ...this.data.metadataCache },
            rules: [...(this.data.rules ?? [])],
            settings: { ...this.data.settings },
        };
        saveToStorage(this.data);
        this.notify();
    }

    /**
     * 获取所有节点
     */
    getAllNodes(): Record<string, Node> {
        return this.data.nodes;
    }

    /**
     * 列出指定父节点的子节点（按 orderKey 排序）
     */
    listNodes(parentId: string | null): Node[] {
        const children = Object.values(this.data.nodes)
            .filter(node => node.parentId === parentId && !node.deletedAt)
            .sort((a, b) => a.orderKey.localeCompare(b.orderKey));

        return children;
    }

    /**
     * 获取单个节点
     */
    getNode(id: string): Node | null {
        const node = this.data.nodes[id];
        if (!node || node.deletedAt) return null;
        return node;
    }

    /**
     * 创建节点
     */
    createNode(request: CreateNodeRequest): Node {
        const siblings = this.listNodes(request.parentId);
        const lastSibling = siblings[siblings.length - 1];

        const now = Date.now();
        const newNode: Node = {
            id: generateId(),
            type: request.type,
            parentId: request.parentId,
            title: request.title,
            orderKey: request.orderKey || generateOrderKey(lastSibling?.orderKey || '', ''),
            createdAt: now,
            updatedAt: now,
        };

        if (request.type === 'bookmark') {
            newNode.url = request.url;
        }

        this.data.nodes[newNode.id] = newNode;
        this.save();

        return newNode;
    }

    /**
     * 更新节点
     */
    updateNode(id: string, patch: UpdateNodeRequest): Node | null {
        const node = this.data.nodes[id];
        if (!node || node.deletedAt) return null;

        const updatedNode: Node = {
            ...node,
            ...patch,
            updatedAt: Date.now(),
        };

        this.data.nodes[id] = updatedNode;
        this.save();

        return updatedNode;
    }

    /**
     * 移动节点（支持批量）
     */
    moveNodes(request: MoveNodesRequest): boolean {
        const { nodeIds, toParentId, beforeId, afterId } = request;

        // 循环检测
        if (detectCycleForMultiple(this.data.nodes, nodeIds, toParentId)) {
            console.warn('Cycle detected, move rejected');
            return false;
        }

        // 获取目标位置的 orderKey
        const targetSiblings = this.listNodes(toParentId);
        let newOrderKeys: string[];

        if (beforeId) {
            const beforeNode = this.data.nodes[beforeId];
            const beforeIndex = targetSiblings.findIndex(n => n.id === beforeId);
            const prevKey = beforeIndex > 0 ? targetSiblings[beforeIndex - 1].orderKey : '';
            newOrderKeys = generateOrderKeys(nodeIds.length, prevKey, beforeNode?.orderKey || '');
        } else if (afterId) {
            const afterNode = this.data.nodes[afterId];
            const afterIndex = targetSiblings.findIndex(n => n.id === afterId);
            const nextKey = afterIndex < targetSiblings.length - 1
                ? targetSiblings[afterIndex + 1].orderKey
                : '';
            newOrderKeys = generateOrderKeys(nodeIds.length, afterNode?.orderKey || '', nextKey);
        } else {
            // 追加到末尾
            const lastSibling = targetSiblings[targetSiblings.length - 1];
            newOrderKeys = generateOrderKeys(nodeIds.length, lastSibling?.orderKey || '', '');
        }

        // 更新节点
        const now = Date.now();
        nodeIds.forEach((nodeId, index) => {
            const node = this.data.nodes[nodeId];
            if (node) {
                this.data.nodes[nodeId] = {
                    ...node,
                    parentId: toParentId,
                    orderKey: newOrderKeys[index],
                    updatedAt: now,
                };
            }
        });

        this.save();
        return true;
    }

    /**
     * 删除节点（支持批量，默认软删除）
     */
    deleteNodes(request: DeleteNodesRequest): void {
        const { nodeIds, hard = false } = request;
        const now = Date.now();

        // 收集所有需要删除的节点（包括子节点）
        const getAllDescendants = (id: string): string[] => {
            const descendants: string[] = [id];
            Object.values(this.data.nodes)
                .filter(n => n.parentId === id && !n.deletedAt)
                .forEach(child => {
                    descendants.push(...getAllDescendants(child.id));
                });
            return descendants;
        };

        const allIdsToDelete = new Set<string>();
        nodeIds.forEach(id => {
            getAllDescendants(id).forEach(descendantId => {
                allIdsToDelete.add(descendantId);
            });
        });

        // root 节点不能删除
        allIdsToDelete.delete('root');

        if (hard) {
            // 硬删除
            allIdsToDelete.forEach(id => {
                delete this.data.nodes[id];
            });
        } else {
            // 软删除
            allIdsToDelete.forEach(id => {
                if (this.data.nodes[id]) {
                    this.data.nodes[id] = {
                        ...this.data.nodes[id],
                        deletedAt: now,
                        updatedAt: now,
                    };
                }
            });
        }

        this.save();
    }

    /**
     * 恢复软删除的节点
     */
    restoreNodes(nodeIds: string[]): void {
        const now = Date.now();

        nodeIds.forEach(id => {
            const node = this.data.nodes[id];
            if (node && node.deletedAt) {
                this.data.nodes[id] = {
                    ...node,
                    deletedAt: undefined,
                    updatedAt: now,
                };
            }
        });

        this.save();
    }

    /**
     * 批量创建节点（用于导入）
     */
    createNodes(nodes: Array<Omit<Node, 'createdAt' | 'updatedAt'>>): Node[] {
        const now = Date.now();
        const created: Node[] = [];

        nodes.forEach(nodeData => {
            const node: Node = {
                ...nodeData,
                createdAt: now,
                updatedAt: now,
            };
            this.data.nodes[node.id] = node;
            created.push(node);
        });

        this.save();
        return created;
    }

    // === 资源管理 ===

    /**
     * 保存资源
     */
    saveAsset(asset: Asset): void {
        this.data.assets[asset.id] = asset;
        this.save();
    }

    /**
     * 获取资源
     */
    getAsset(id: string): Asset | null {
        return this.data.assets[id] || null;
    }

    /**
     * 删除资源
     */
    deleteAsset(id: string): void {
        delete this.data.assets[id];
        this.save();
    }

    // === 元信息缓存 ===

    /**
     * 获取缓存的元信息
     */
    getMetadataCache(url: string): UrlMetadataCache | null {
        return this.data.metadataCache[url] || null;
    }

    /**
     * 保存元信息缓存
     */
    setMetadataCache(cache: UrlMetadataCache): void {
        this.data.metadataCache[cache.url] = cache;
        this.save();
    }

    // === 设置 ===

    /**
     * 获取设置
     */
    getSettings(): StorageData['settings'] {
        return this.data.settings;
    }

    /**
     * 更新设置
     */
    updateSettings(patch: Partial<StorageData['settings']>): void {
        this.data.settings = {
            ...this.data.settings,
            ...patch,
        };
        this.save();
    }

    /**
     * 获取主题
     */
    getTheme(): Theme {
        return this.data.settings.theme;
    }

    /**
     * 设置主题
     */
    setTheme(theme: Theme): void {
        this.data.settings.theme = theme;
        this.save();
    }

    /**
     * 获取语言
     */
    getLocale(): Locale {
        return this.data.settings.locale;
    }

    // === 自动整理规则 ===

    /**
     * 获取全部规则，按优先级升序
     */
    getRules(): AutoOrganizeRule[] {
        return [...(this.data.rules ?? [])].sort((a, b) => a.priority - b.priority);
    }

    /**
     * 覆写全部规则
     */
    setRules(rules: AutoOrganizeRule[]): void {
        this.data.rules = [...rules].sort((a, b) => a.priority - b.priority);
        this.save();
    }

    /**
     * 批量追加规则（从模板展开时用）
     *
     * 一次性写入而不是循环调 addRule：循环会触发多次 save 与通知，
     * 界面会看到规则一条条蹦出来。
     */
    addRules(partials: Array<Omit<AutoOrganizeRule, 'priority' | 'createdAt' | 'updatedAt'>>): void {
        if (partials.length === 0) return;

        const now = Date.now();
        const existing = this.data.rules ?? [];
        const maxPriority = existing.reduce((max, r) => Math.max(max, r.priority), 0);

        const created = partials.map((rule, offset) => ({
            ...rule,
            priority: maxPriority + offset + 1,
            createdAt: now,
            updatedAt: now,
        }));

        this.data.rules = [...existing, ...created];
        this.save();
    }

    /**
     * 批量替换：删除 fromId，插入 additions
     *
     * 去掉一条宽泛规则再补上几条更具体的，是个整体动作——
     * 分两次调用会让订阅者看到中间态。
     */
    replaceRule(fromId: string, additions: AutoOrganizeRule[]): void {
        const now = Date.now();
        const existing = this.data.rules ?? [];
        const index = existing.findIndex(r => r.id === fromId);
        if (index < 0) return;

        const maxPriority = existing.reduce((max, r) => Math.max(max, r.priority), 0);

        const stamped = additions.map((rule, offset) => ({
            ...rule,
            priority: maxPriority + offset + 1,
            createdAt: now,
            updatedAt: now,
        }));

        this.data.rules = [
            ...existing.slice(0, index),
            ...stamped,
            ...existing.slice(index + 1),
        ];
        this.save();
    }

    /**
     * 新增一条规则，追加到优先级末尾
     */
    addRule(rule: Omit<AutoOrganizeRule, 'priority' | 'createdAt' | 'updatedAt'>): AutoOrganizeRule {
        const now = Date.now();
        const existing = this.data.rules ?? [];
        const maxPriority = existing.reduce((max, r) => Math.max(max, r.priority), 0);

        const created: AutoOrganizeRule = {
            ...rule,
            priority: maxPriority + 1,
            createdAt: now,
            updatedAt: now,
        };
        this.data.rules = [...existing, created];
        this.save();
        return created;
    }

    /**
     * 更新一条规则
     */
    updateRule(id: string, patch: Partial<AutoOrganizeRule>): AutoOrganizeRule | null {
        const existing = this.data.rules ?? [];
        const index = existing.findIndex(r => r.id === id);
        if (index < 0) return null;

        const updated: AutoOrganizeRule = {
            ...existing[index],
            ...patch,
            id: existing[index].id,
            updatedAt: Date.now(),
        };
        const next = [...existing];
        next[index] = updated;
        this.data.rules = next;
        this.save();
        return updated;
    }

    /**
     * 删除一条规则
     */
    deleteRule(id: string): void {
        this.data.rules = (this.data.rules ?? []).filter(r => r.id !== id);
        this.save();
    }

    /**
     * 重排优先级：按传入的 id 顺序依次赋 1..n
     */
    reorderRules(orderedIds: string[]): void {
        const existing = this.data.rules ?? [];
        const byId = new Map(existing.map(r => [r.id, r]));
        const reordered: AutoOrganizeRule[] = [];

        orderedIds.forEach((id, index) => {
            const rule = byId.get(id);
            if (rule) {
                reordered.push({ ...rule, priority: index + 1, updatedAt: Date.now() });
                byId.delete(id);
            }
        });
        // 未出现在 orderedIds 里的保持原顺序追加在后
        byId.forEach(rule => reordered.push(rule));

        this.data.rules = reordered;
        this.save();
    }
    /**
     * 设置语言
     */
    setLocale(locale: Locale): void {
        this.data.settings.locale = locale;
        this.save();
    }

    /**
     * 获取视图模式
     */
    getViewMode(): ViewMode {
        return this.data.settings.viewMode;
    }

    /**
     * 设置视图模式
     */
    setViewMode(viewMode: ViewMode): void {
        this.data.settings.viewMode = viewMode;
        this.save();
    }

    // === 导入导出 ===

    /**
     * 导出全部数据（用于备份）
     */
    exportAll(): StorageData {
        return JSON.parse(JSON.stringify(this.data));
    }

    /**
     * 导入数据（用于恢复）
     */
    importAll(data: StorageData): void {
        this.data = data;
        this.save();
    }

    /**
     * 清空所有数据（危险操作）
     */
    clearAll(): void {
        this.data = getDefaultData();
        this.save();
    }

    /**
     * 获取存储使用情况
     */
    getStorageUsage(): { used: number; limit: number } {
        const raw = localStorage.getItem(STORAGE_KEY) || '';
        const used = new Blob([raw]).size;
        // LocalStorage 限制通常是 5-10MB
        const limit = 5 * 1024 * 1024;
        return { used, limit };
    }
}

// 创建单例
let storageInstance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
    if (!storageInstance) {
        storageInstance = new StorageAdapter();
    }
    return storageInstance;
}
