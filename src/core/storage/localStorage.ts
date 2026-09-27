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
} from '../types';
import { generateId } from '../utils';
import { generateOrderKey, generateOrderKeys } from '../orderKey';
import { detectCycleForMultiple } from '../cycleDetection';

const STORAGE_KEY = 'aurabookmarks_data';
const CURRENT_VERSION = 1;

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

        const data = JSON.parse(raw) as StorageData;
        const defaults = getDefaultData();

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

        // 版本迁移（预留）
        if (data.version !== CURRENT_VERSION) {
            // TODO: 实现迁移逻辑
            data.version = CURRENT_VERSION;
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
