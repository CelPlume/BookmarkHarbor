/**
 * AuraBookmarks 主应用组件
 */

import { useMemo, useRef, useState, useCallback, useEffect, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, Button, Modal } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    rectIntersection,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

// Core
import type { Node, ExportScope, Locale, CardFolderPreviewSize, ViewMode, SingleClickAction, SortField, SortOrder } from './core/types';
import {
    useNodes,
    useNodeActions,
    useTheme,
    useViewMode,
    useLocale,
    useSelection,
    useKeyboardShortcuts,
    useHistory,
    useSettings,
    getStorage,
    buildBreadcrumbs,
    htmlFileSchema,
    detectCycleForMultiple,
    cn,
} from './core';
import { importHtmlFile } from './core/importExport/htmlParser';
import { exportAndDownload } from './core/importExport/htmlExporter';
import { generateOrderKey } from './core/orderKey';

// Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { ContentArea } from './components/ContentArea';
import { Inspector } from './components/Inspector';
import { SelectionToolbar } from './components/SelectionToolbar';
import { PanelResizer } from './components/PanelResizer';
import { SettingsModal } from './components/SettingsModal';

// i18n
import { changeLanguage } from './i18n';

type ModifierKeys = {
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
};

function parseFolderDropId(id: string): { folderId: string } | null {
    const prefixes = ['content-folder:', 'sidebar-folder:'] as const;
    for (const prefix of prefixes) {
        if (id.startsWith(prefix)) {
            return { folderId: id.slice(prefix.length) };
        }
    }
    return null;
}

function parseContentDropId(id: string): { folderId: string } | null {
    const prefix = 'content:';
    if (!id.startsWith(prefix)) return null;
    return { folderId: id.slice(prefix.length) };
}

// 面板宽度：默认中档，可小一档(×0.8)、大两档(×1.4)，无极调节
const PANEL_WIDTH_KEY = 'aurabookmarks_panel_widths';
const SIDEBAR_WIDTH_DEFAULT = 240;
const SIDEBAR_WIDTH_MIN = Math.round(SIDEBAR_WIDTH_DEFAULT * 0.8);
const SIDEBAR_WIDTH_MAX = Math.round(SIDEBAR_WIDTH_DEFAULT * 1.4);
const INSPECTOR_WIDTH_DEFAULT = 320;
const INSPECTOR_WIDTH_MIN = Math.round(INSPECTOR_WIDTH_DEFAULT * 0.8);
const INSPECTOR_WIDTH_MAX = Math.round(INSPECTOR_WIDTH_DEFAULT * 1.4);

function clampPanelWidth(value: number, min: number, max: number): number {
    return Math.min(Math.max(Math.round(value), min), max);
}

function loadPanelWidth(name: 'sidebar' | 'inspector', def: number): number {
    try {
        const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
        if (raw) {
            const value = JSON.parse(raw)[name];
            if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
        }
    } catch {
        /* ignore */
    }
    return def;
}

function savePanelWidth(name: 'sidebar' | 'inspector', value: number): void {
    try {
        const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
        const all = raw ? JSON.parse(raw) : {};
        all[name] = value;
        window.localStorage.setItem(PANEL_WIDTH_KEY, JSON.stringify(all));
    } catch {
        /* ignore */
    }
}

export function App() {
    const { t, i18n } = useTranslation();
    const { nodes } = useNodes();
    const { createNode, updateNode, moveNodes, deleteNodes, restoreNodes } = useNodeActions();
    const [theme, setTheme] = useTheme();
    const [viewMode, setViewMode] = useViewMode();
    const [locale, setLocale] = useLocale();
    const { settings, updateSettings } = useSettings();

    // 状态
    const [currentFolderId, setCurrentFolderId] = useState('root');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [currentView, setCurrentView] = useState<'bookmarks' | 'favorites' | 'readLater' | 'trash'>('bookmarks');
    const [selectionMode, setSelectionMode] = useState(false);
    const [sortField, setSortField] = useState<SortField>('default');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[]>([]);
    const [clearDataConfirmOpen, setClearDataConfirmOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // 面板宽度（可拖拽无极调节，本地持久化）
    const layoutRef = useRef<HTMLDivElement>(null);
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => loadPanelWidth('sidebar', SIDEBAR_WIDTH_DEFAULT));
    const [inspectorWidth, setInspectorWidth] = useState<number>(() => loadPanelWidth('inspector', INSPECTOR_WIDTH_DEFAULT));

    useEffect(() => {
        savePanelWidth('sidebar', sidebarWidth);
    }, [sidebarWidth]);

    useEffect(() => {
        savePanelWidth('inspector', inspectorWidth);
    }, [inspectorWidth]);

    const handleSidebarResize = useCallback((clientX: number) => {
        const left = layoutRef.current?.getBoundingClientRect().left ?? 0;
        setSidebarWidth(clampPanelWidth(clientX - left, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX));
    }, []);

    const handleInspectorResize = useCallback((clientX: number) => {
        const right = layoutRef.current?.getBoundingClientRect().right ?? window.innerWidth;
        setInspectorWidth(clampPanelWidth(right - clientX, INSPECTOR_WIDTH_MIN, INSPECTOR_WIDTH_MAX));
    }, []);

    const autoExpandTree = settings.autoExpandTree;
    const cardFolderPreviewSize = settings.cardFolderPreviewSize;
    const customColors = settings.customColors;
    const defaultViewMode = settings.defaultViewMode;
    const rememberFolderView = settings.rememberFolderView;
    const folderViewModes = settings.folderViewModes ?? {};
    const themeColor = settings.themeColor;
    const singleClickAction = settings.singleClickAction;
    const cardColumnsDesktop = settings.cardColumnsDesktop;
    const cardColumnsMobile = settings.cardColumnsMobile;
    const tileColumnsDesktop = settings.tileColumnsDesktop;
    const tileColumnsMobile = settings.tileColumnsMobile;

    // 应用主题色到 CSS 变量
    useEffect(() => {
        const root = document.documentElement;
        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result
                ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16),
                }
                : { r: 59, g: 130, b: 246 };
        };

        const rgbToHex = (r: number, g: number, b: number) => {
            const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        };

        const rgbToHsl = (r: number, g: number, b: number) => {
            const r1 = r / 255;
            const g1 = g / 255;
            const b1 = b / 255;
            const max = Math.max(r1, g1, b1);
            const min = Math.min(r1, g1, b1);
            const delta = max - min;

            let h = 0;
            if (delta !== 0) {
                if (max === r1) h = ((g1 - b1) / delta) % 6;
                else if (max === g1) h = (b1 - r1) / delta + 2;
                else h = (r1 - g1) / delta + 4;
                h *= 60;
                if (h < 0) h += 360;
            }

            const l = (max + min) / 2;
            const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

            return {
                h,
                s: s * 100,
                l: l * 100,
            };
        };

        const hslToRgb = (h: number, s: number, l: number) => {
            const s1 = clamp(s, 0, 100) / 100;
            const l1 = clamp(l, 0, 100) / 100;
            const c = (1 - Math.abs(2 * l1 - 1)) * s1;
            const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
            const m = l1 - c / 2;

            let r1 = 0;
            let g1 = 0;
            let b1 = 0;

            if (h >= 0 && h < 60) {
                r1 = c;
                g1 = x;
            } else if (h >= 60 && h < 120) {
                r1 = x;
                g1 = c;
            } else if (h >= 120 && h < 180) {
                g1 = c;
                b1 = x;
            } else if (h >= 180 && h < 240) {
                g1 = x;
                b1 = c;
            } else if (h >= 240 && h < 300) {
                r1 = x;
                b1 = c;
            } else {
                r1 = c;
                b1 = x;
            }

            return {
                r: Math.round((r1 + m) * 255),
                g: Math.round((g1 + m) * 255),
                b: Math.round((b1 + m) * 255),
            };
        };

        root.style.setProperty('--color-primary', themeColor);

        const baseRgb = hexToRgb(themeColor);
        const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);

        const shadeOffsets: Record<number, number> = {
            50: 45,
            100: 35,
            200: 25,
            300: 15,
            400: 7,
            500: 0,
            600: -7,
            700: -15,
            800: -25,
            900: -35,
            950: -45,
        };

        const accent = `hsl(${Math.round(baseHsl.h)} ${Math.round(baseHsl.s)}% ${Math.round(baseHsl.l)}%)`;
        const primaryForeground = baseHsl.l >= 60 ? '#000000' : '#ffffff';
        root.style.setProperty('--accent', accent);
        root.style.setProperty('--accent-foreground', primaryForeground);
        root.style.setProperty('--focus', accent);

        for (const [shadeStr, offset] of Object.entries(shadeOffsets)) {
            const shade = Number(shadeStr);
            const l = clamp(baseHsl.l + offset, 0, 100);
            const rgb = hslToRgb(baseHsl.h, baseHsl.s, l);

            root.style.setProperty(`--color-primary-${shade}-rgb`, `${rgb.r}, ${rgb.g}, ${rgb.b}`);

            if (shade === 500) {
                root.style.setProperty('--color-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
            }

            if (shade === 600) {
                root.style.setProperty('--color-primary-hover', rgbToHex(rgb.r, rgb.g, rgb.b));
            }

            if (shade === 50) {
                root.style.setProperty('--color-primary-light', rgbToHex(rgb.r, rgb.g, rgb.b));
            }
        }
    }, [themeColor]);

    // 面包屑
    const breadcrumbs = useMemo(() => {
        return buildBreadcrumbs(nodes, currentFolderId);
    }, [nodes, currentFolderId]);

    useEffect(() => {
        if (!autoExpandTree || currentView !== 'bookmarks') return;
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            breadcrumbs.forEach((crumb) => {
                if (crumb.id !== 'root') {
                    next.add(crumb.id);
                }
            });
            return next;
        });
    }, [autoExpandTree, breadcrumbs, currentView]);

    // 获取当前文件夹的子节点
    const currentChildren = useMemo(() => {
        if (currentView !== 'bookmarks') return [];
        return Object.values(nodes)
            .filter(n => n.parentId === currentFolderId && !n.deletedAt)
            .sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                }
                return a.orderKey.localeCompare(b.orderKey);
            });
    }, [currentView, nodes, currentFolderId]);

    const baseNodes = useMemo(() => {
        if (currentView === 'favorites') {
            return Object.values(nodes)
                .filter(n => n.isFavorite && !n.deletedAt && n.id !== 'root')
                .sort((a, b) => a.orderKey.localeCompare(b.orderKey));
        }
        if (currentView === 'readLater') {
            return Object.values(nodes)
                .filter(n => n.isReadLater && !n.deletedAt && n.id !== 'root')
                .sort((a, b) => a.orderKey.localeCompare(b.orderKey));
        }
        if (currentView === 'trash') {
            return Object.values(nodes)
                .filter(n => n.deletedAt && n.id !== 'root')
                .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
        }
        return currentChildren;
    }, [currentChildren, currentView, nodes]);

    // 搜索过滤 + 排序（仅视觉排序，不修改存储顺序）
    const visibleNodes = useMemo(() => {
        const source = (() => {
            if (!searchQuery) return baseNodes;

            const query = searchQuery.toLowerCase();
            const searchSource = currentView === 'bookmarks'
                ? Object.values(nodes).filter(n => !n.deletedAt && n.id !== 'root')
                : baseNodes;

            return searchSource
                .filter(n =>
                    n.title.toLowerCase().includes(query) ||
                    (n.url && n.url.toLowerCase().includes(query))
                )
                .sort((a, b) => a.orderKey.localeCompare(b.orderKey));
        })();

        if (sortField === 'default') return source;

        const typeRank = (node: Node) => (node.type === 'folder' ? 0 : 1);

        const sorted = [...source].sort((a, b) => {
            const typeDiff = typeRank(a) - typeRank(b);
            if (sortField !== 'type' && currentView === 'bookmarks' && typeDiff !== 0) {
                return typeDiff;
            }

            let diff = 0;
            switch (sortField) {
                case 'title':
                    diff = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
                    break;
                case 'updatedAt':
                    diff = (a.updatedAt ?? a.createdAt ?? 0) - (b.updatedAt ?? b.createdAt ?? 0);
                    break;
                case 'createdAt':
                    diff = (a.createdAt ?? 0) - (b.createdAt ?? 0);
                    break;
                case 'type':
                    diff = typeDiff;
                    break;
                default:
                    diff = 0;
                    break;
            }

            if (diff === 0) {
                diff = a.orderKey.localeCompare(b.orderKey);
            }

            return sortOrder === 'asc' ? diff : -diff;
        });

        return sorted;
    }, [baseNodes, currentView, nodes, searchQuery, sortField, sortOrder]);

    const isSortableView = currentView === 'bookmarks' && !searchQuery && sortField === 'default';

    // 选择管理
    const selection = useSelection({ visibleNodes });
    const history = useHistory({ limit: 200 });

    const activeViewMode = useMemo(() => {
        if (currentView !== 'bookmarks' || !rememberFolderView) {
            return viewMode;
        }
        return folderViewModes[currentFolderId] ?? defaultViewMode ?? viewMode;
    }, [currentFolderId, currentView, defaultViewMode, folderViewModes, rememberFolderView, viewMode]);

    const handleViewModeChange = useCallback((mode: ViewMode) => {
        if (currentView === 'bookmarks' && rememberFolderView) {
            updateSettings({
                folderViewModes: {
                    ...folderViewModes,
                    [currentFolderId]: mode,
                },
            });
            return;
        }
        setViewMode(mode);
    }, [currentFolderId, currentView, folderViewModes, rememberFolderView, setViewMode, updateSettings]);

    const handleSortChange = useCallback((field: SortField, order: SortOrder) => {
        setSortField(field);
        setSortOrder(order);
    }, []);

    type UpdatePatch = Parameters<typeof updateNode>[1];
    type UpdateEntry = { id: string; patch: UpdatePatch };

    const applyNodeUpdates = useCallback((updates: UpdateEntry[], options?: { mergeKey?: string; label?: string }) => {
        const normalized: Array<{ id: string; patch: UpdatePatch; before: UpdatePatch }> = [];

        updates.forEach(({ id, patch }) => {
            const node = nodes[id];
            if (!node) return;

            const diff = {} as UpdatePatch;
            const before = {} as UpdatePatch;

            (Object.keys(patch) as Array<keyof UpdatePatch>).forEach((key) => {
                const nextValue = patch[key];
                const prevValue = node[key as keyof Node] as UpdatePatch[keyof UpdatePatch];
                if (prevValue !== nextValue) {
                    (diff as Record<keyof UpdatePatch, UpdatePatch[keyof UpdatePatch]>)[key] =
                        nextValue as UpdatePatch[keyof UpdatePatch];
                    (before as Record<keyof UpdatePatch, UpdatePatch[keyof UpdatePatch]>)[key] =
                        prevValue as UpdatePatch[keyof UpdatePatch];
                }
            });

            if (Object.keys(diff).length > 0) {
                normalized.push({ id, patch: diff, before });
            }
        });

        if (normalized.length === 0) return;

        normalized.forEach(({ id, patch }) => updateNode(id, patch));

        const mergeKey = options?.mergeKey && normalized.length === 1
            ? `${options.mergeKey}:${normalized[0].id}`
            : options?.mergeKey;

        history.record({
            label: options?.label,
            mergeKey,
            undo: () => {
                normalized.forEach(({ id, before }) => updateNode(id, before));
            },
            redo: () => {
                normalized.forEach(({ id, patch }) => updateNode(id, patch));
            },
        });
    }, [history, nodes, updateNode]);

    useEffect(() => {
        const currentLanguage = i18n.language?.split('-')[0] ?? 'zh';
        if (currentLanguage !== locale) {
            changeLanguage(locale);
        }
    }, [i18n.language, locale]);

    // 处理语言切换
    const handleLocaleChange = useCallback((newLocale: Locale) => {
        setLocale(newLocale);
        changeLanguage(newLocale);
    }, [setLocale]);

    const handleAutoExpandTreeChange = useCallback((value: boolean) => {
        updateSettings({ autoExpandTree: value });
    }, [updateSettings]);

    const handleCardFolderPreviewSizeChange = useCallback((size: CardFolderPreviewSize) => {
        updateSettings({ cardFolderPreviewSize: size });
    }, [updateSettings]);

    const handleDefaultViewModeChange = useCallback((mode: ViewMode) => {
        updateSettings({ defaultViewMode: mode });
        setViewMode(mode);
    }, [setViewMode, updateSettings]);

    const handleRememberFolderViewChange = useCallback((value: boolean) => {
        if (value) {
            updateSettings({
                rememberFolderView: true,
                folderViewModes: {
                    ...folderViewModes,
                    [currentFolderId]: activeViewMode,
                },
            });
            return;
        }
        updateSettings({ rememberFolderView: false });
        setViewMode(activeViewMode);
    }, [activeViewMode, currentFolderId, folderViewModes, setViewMode, updateSettings]);

    const handleThemeColorChange = useCallback((color: string) => {
        updateSettings({ themeColor: color });
    }, [updateSettings]);

    const handleSingleClickActionChange = useCallback((action: SingleClickAction) => {
        updateSettings({ singleClickAction: action });
    }, [updateSettings]);

    const handleCardColumnsDesktopChange = useCallback((value: number) => {
        const next = Math.min(9, Math.max(2, Math.round(value)));
        updateSettings({ cardColumnsDesktop: next });
    }, [updateSettings]);

    const handleCardColumnsMobileChange = useCallback((value: number) => {
        const next = Math.min(4, Math.max(1, Math.round(value)));
        updateSettings({ cardColumnsMobile: next });
    }, [updateSettings]);

    const handleTileColumnsDesktopChange = useCallback((value: number) => {
        const next = Math.min(7, Math.max(1, Math.round(value)));
        updateSettings({ tileColumnsDesktop: next });
    }, [updateSettings]);

    const handleTileColumnsMobileChange = useCallback((value: number) => {
        const next = Math.min(2, Math.max(1, Math.round(value)));
        updateSettings({ tileColumnsMobile: next });
    }, [updateSettings]);

    // 导航到文件夹
    const handleNavigate = useCallback((folderId: string) => {
        setCurrentFolderId(folderId);
        setSearchQuery('');
        selection.clearSelection();
    }, [selection]);

    // 双击处理
    const handleDoubleClick = useCallback((node: Node) => {
        if (node.type === 'folder') {
            handleNavigate(node.id);
        } else if (node.url && node.url.startsWith('http')) {
            window.open(node.url, '_blank');
        }
    }, [handleNavigate]);

    // 新建文件夹
    const handleNewFolder = useCallback(() => {
        const newNode = createNode({
            type: 'folder',
            parentId: currentFolderId,
            title: t('toolbar.newFolder'),
        });
        selection.selectOne(newNode.id);
        setInspectorOpen(true);
        setRenamingId(newNode.id);
    }, [createNode, currentFolderId, selection, t]);

    // 新建书签
    const handleNewBookmark = useCallback(() => {
        const newNode = createNode({
            type: 'bookmark',
            parentId: currentFolderId,
            title: t('toolbar.newBookmark'),
            url: '',
        });
        selection.selectOne(newNode.id);
        setInspectorOpen(true);
        setRenamingId(newNode.id);
    }, [createNode, currentFolderId, selection, t]);

    const applyTrashChange = useCallback((ids: string[], action: 'delete' | 'restore') => {
        if (ids.length === 0) return null;

        if (action === 'delete') {
            deleteNodes(ids);
            const entry = {
                label: 'trash-delete',
                undo: () => restoreNodes(ids),
                redo: () => deleteNodes(ids),
            };
            history.record(entry);
            return entry.undo;
        }

        restoreNodes(ids);
        const entry = {
            label: 'trash-restore',
            undo: () => deleteNodes(ids),
            redo: () => restoreNodes(ids),
        };
        history.record(entry);
        return entry.undo;
    }, [deleteNodes, history, restoreNodes]);

    const handleDelete = useCallback(() => {
        if (selection.selectedIds.size === 0) return;
        setDeleteConfirmIds(Array.from(selection.selectedIds));
        setDeleteConfirmOpen(true);
    }, [selection.selectedIds]);

    const handleConfirmDelete = useCallback(() => {
        if (deleteConfirmIds.length === 0) {
            setDeleteConfirmOpen(false);
            return;
        }

        const ids = deleteConfirmIds;
        const count = ids.length;

        if (currentView === 'trash') {
            deleteNodes(ids, true);
            selection.clearSelection();
            setDeleteConfirmOpen(false);
            setDeleteConfirmIds([]);
            toast(t('toast.deletedPermanent', { count }), { variant: 'warning', timeout: 3000 });
            return;
        }

        const undoDelete = applyTrashChange(ids, 'delete');
        selection.clearSelection();

        setDeleteConfirmOpen(false);
        setDeleteConfirmIds([]);

        toast(t('toast.deleted', { count }), {
            timeout: 5000,
            actionProps: {
                children: t('toast.undo'),
                onPress: undoDelete ?? history.undo,
            },
        });
    }, [applyTrashChange, currentView, deleteConfirmIds, deleteNodes, history.undo, selection, t]);

    // 重命名提交
    const handleRenameSubmit = useCallback((id: string, newTitle: string) => {
        if (newTitle.trim()) {
            applyNodeUpdates([{ id, patch: { title: newTitle.trim() } }], { mergeKey: 'title' });
        }
        setRenamingId(null);
    }, [applyNodeUpdates]);

    // 重命名取消
    const handleRenameCancel = useCallback(() => {
        setRenamingId(null);
    }, []);

    // 清除全部数据（清空 localStorage 全部键，并重置应用状态为默认）
    const handleConfirmClearData = useCallback(() => {
        localStorage.clear();
        getStorage().clearAll();
        setCurrentFolderId('root');
        setCurrentView('bookmarks');
        setSidebarOpen(true);
        setInspectorOpen(false);
        setSelectionMode(false);
        setRenamingId(null);
        setExpandedFolders(new Set());
        setSortField('default');
        setSortOrder('asc');
        setSidebarWidth(SIDEBAR_WIDTH_DEFAULT);
        setInspectorWidth(INSPECTOR_WIDTH_DEFAULT);
        selection.clearSelection();
        history.clear();
        setSettingsOpen(false);
        setClearDataConfirmOpen(false);
        toast(t('toast.cleared'), { variant: 'warning', timeout: 3000 });
    }, [history, selection, t]);

    // dnd-kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const collisionDetection = useCallback(
        (args: Parameters<typeof rectIntersection>[0]) => {
            const base = activeViewMode === 'list' ? closestCenter : rectIntersection;
            const collisions = base(args);
            const nonContentCollisions = collisions.filter(({ id }) => !String(id).startsWith('content:'));
            const pruned = nonContentCollisions.length > 0 ? nonContentCollisions : collisions;
            const activeId = String(args.active.id);
            const activeNode = nodes[activeId];
            const isDraggingBookmark = activeNode?.type === 'bookmark';
            if (!isDraggingBookmark) return pruned;

            const folderCollisions = pruned.filter(({ id }) => {
                const str = String(id);
                return str.startsWith('content-folder:') || str.startsWith('sidebar-folder:');
            });

            return folderCollisions.length > 0 ? folderCollisions : pruned;
        },
        [activeViewMode, nodes]
    );

    const getDragNodeIds = useCallback((activeId: string): string[] => {
        if (!isSortableView) return [activeId];
        if (!selection.selectedIds.has(activeId)) return [activeId];
        const visibleIndex = new Map(visibleNodes.map((n, i) => [n.id, i]));
        return Array.from(selection.selectedIds).sort((a, b) => {
            return (visibleIndex.get(a) ?? 0) - (visibleIndex.get(b) ?? 0);
        });
    }, [isSortableView, selection.selectedIds, visibleNodes]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        if (!isSortableView) return;
        setActiveDragId(String(event.active.id));
    }, [isSortableView]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        if (!isSortableView) {
            setActiveDragId(null);
            return;
        }
        const activeId = String(event.active.id);
        const overId = event.over?.id ? String(event.over.id) : null;
        setActiveDragId(null);
        if (!overId || activeId === overId) return;

        const nodeIds = getDragNodeIds(activeId);

        // Folder drop targets (content or sidebar)
        const folderDrop = parseFolderDropId(overId);
        if (folderDrop) {
            if (detectCycleForMultiple(nodes, nodeIds, folderDrop.folderId)) {
                console.warn('Cannot move folder into itself or its descendants');
                return;
            }

            moveNodes({ nodeIds, toParentId: folderDrop.folderId });
            return;
        }

        // Drop on content background: append to the current folder
        const contentDrop = parseContentDropId(overId);
        if (contentDrop) {
            moveNodes({ nodeIds, toParentId: contentDrop.folderId });
            return;
        }

        // Reorder within current folder (disabled when searching)
        if (searchQuery) return;

        if (nodeIds.includes(overId)) return;

        const activeNode = nodes[activeId];
        const overNode = nodes[overId];
        if (!activeNode || !overNode) return;
        if (activeNode.parentId !== currentFolderId || overNode.parentId !== currentFolderId) return;

        const orderedIds = currentChildren.map((n) => n.id);
        const activeIndex = orderedIds.indexOf(activeId);
        const overIndex = orderedIds.indexOf(overId);
        if (activeIndex === -1 || overIndex === -1) return;

        if (activeIndex < overIndex) {
            moveNodes({ nodeIds, toParentId: currentFolderId, afterId: overId });
        } else {
            moveNodes({ nodeIds, toParentId: currentFolderId, beforeId: overId });
        }
    }, [currentChildren, currentFolderId, getDragNodeIds, isSortableView, moveNodes, nodes, searchQuery]);

    // 导入 HTML
    const handleImport = useCallback(async (files: FileList) => {
        const storage = getStorage();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const validated = htmlFileSchema.safeParse(file);
            if (!validated.success) {
                console.error('Import skipped:', file.name, validated.error.issues[0]?.message);
                continue;
            }
            const content = await file.text();

            try {
                const result = importHtmlFile(content, file.name, currentFolderId);

                if (result.allNodes.length > 0) {
                    // 设置 orderKey
                    const siblings = storage.listNodes(currentFolderId);
                    const lastSibling = siblings[siblings.length - 1];
                    result.rootNode.orderKey = generateOrderKey(lastSibling?.orderKey || '', '');

                    // 批量创建
                    storage.createNodes(result.allNodes as Node[]);
                }

                if (result.errors.length > 0) {
                    console.error('Import errors:', result.errors);
                }
            } catch (error) {
                console.error('Failed to import:', file.name, error);
            }
        }
    }, [currentFolderId]);

    // 导出
    const handleExport = useCallback((scope: ExportScope) => {
        if (scope === 'selection' && selection.selectedIds.size === 0) {
            toast(t('toast.exportSelectionEmpty'), { variant: 'warning', timeout: 3000 });
            return;
        }
        try {
            exportAndDownload(scope, nodes, {
                folderId: scope === 'folder' ? currentFolderId : undefined,
                selectedIds: scope === 'selection' ? Array.from(selection.selectedIds) : undefined,
            });
        } catch (error) {
            console.error('Export failed:', error);
        }
    }, [nodes, currentFolderId, selection.selectedIds, t]);

    // 更新节点
    const handleUpdateNode = useCallback((id: string, updates: Parameters<typeof updateNode>[1]) => {
        const keys = Object.keys(updates);
        const mergeKey = keys.length === 1 && (keys[0] === 'title' || keys[0] === 'url')
            ? keys[0]
            : undefined;
        applyNodeUpdates([{ id, patch: updates }], { mergeKey });
    }, [applyNodeUpdates]);

    // 展开/收起文件夹
    const handleToggleExpand = useCallback((id: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // 添加自定义颜色
    const handleAddCustomColor = useCallback((color: string) => {
        if (customColors.includes(color)) return;
        const nextColors = [color, ...customColors].slice(0, 12);
        updateSettings({ customColors: nextColors });
    }, [customColors, updateSettings]);

    // 收藏选中项
    const handleFavorite = useCallback(() => {
        if (selection.selectedIds.size === 0) return;
        const ids = Array.from(selection.selectedIds);
        const shouldFavorite = !ids.every(id => nodes[id]?.isFavorite);
        const updates = ids
            .filter(id => nodes[id])
            .map(id => ({ id, patch: { isFavorite: shouldFavorite } }));
        applyNodeUpdates(updates, { label: 'favorite' });
        toast(shouldFavorite ? t('toast.favorited') : t('toast.unfavorited'), {
            variant: 'success',
            timeout: 3000,
        });
    }, [applyNodeUpdates, nodes, selection, t]);

    // 添加到稍后阅读
    const handleReadLater = useCallback(() => {
        if (selection.selectedIds.size === 0) return;
        const ids = Array.from(selection.selectedIds);
        const shouldReadLater = !ids.every(id => nodes[id]?.isReadLater);
        const updates = ids
            .filter(id => nodes[id])
            .map(id => ({ id, patch: { isReadLater: shouldReadLater } }));
        applyNodeUpdates(updates, { label: 'read-later' });
        toast(shouldReadLater ? t('toast.readLaterAdded') : t('toast.readLaterRemoved'), {
            variant: 'success',
            timeout: 3000,
        });
    }, [applyNodeUpdates, nodes, selection, t]);

    const handleRestore = useCallback(() => {
        if (selection.selectedIds.size === 0) return;
        const ids = Array.from(selection.selectedIds);
        applyTrashChange(ids, 'restore');
        selection.clearSelection();
        toast(t('toast.restored', { count: ids.length }), { variant: 'success', timeout: 3000 });
    }, [applyTrashChange, selection, t]);

    // 导航到收藏夹
    const handleNavigateToFavorites = useCallback(() => {
        setCurrentView('favorites');
        selection.clearSelection();
    }, [selection]);

    // 导航到稍后阅读
    const handleNavigateToReadLater = useCallback(() => {
        setCurrentView('readLater');
        selection.clearSelection();
    }, [selection]);

    // 导航到回收站
    const handleNavigateToTrash = useCallback(() => {
        setCurrentView('trash');
        selection.clearSelection();
    }, [selection]);

    // 导航到文件夹时重置视图
    const handleFolderClick = useCallback((folderId: string) => {
        setCurrentView('bookmarks');
        handleNavigate(folderId);
    }, [handleNavigate]);

    // 选择处理
    const handleSelect = useCallback((id: string, keys: ModifierKeys, options?: { forceToggle?: boolean }) => {
        if (activeViewMode === 'list' && keys.shiftKey) {
            selection.selectRange(id);
            return;
        }

        const shouldToggle = options?.forceToggle || keys.metaKey || keys.ctrlKey || selectionMode;
        if (shouldToggle) {
            selection.toggleSelect(id);
            return;
        }

        selection.selectOne(id);
    }, [activeViewMode, selection, selectionMode]);

    const handlePrimaryAction = useCallback((node: Node, keys: ModifierKeys) => {
        const shouldOpen = singleClickAction === 'open'
            && !keys.shiftKey
            && !keys.metaKey
            && !keys.ctrlKey
            && !selectionMode;

        if (shouldOpen) {
            handleDoubleClick(node);
            return;
        }

        handleSelect(node.id, keys);
    }, [handleDoubleClick, handleSelect, selectionMode, singleClickAction]);

    // 键盘快捷键
    useKeyboardShortcuts({
        disabled: false,
        isRenaming: renamingId !== null,
        onDelete: handleDelete,
        onRename: () => {
            if (selection.selectedIds.size === 1) {
                setRenamingId(Array.from(selection.selectedIds)[0]);
            }
        },
        onSelectAll: selection.selectAll,
        onUndo: history.undo,
        onRedo: history.redo,
        onEscape: () => {
            if (renamingId) {
                setRenamingId(null);
            } else {
                selection.clearSelection();
            }
        },
        onBack: () => {
            const parent = nodes[currentFolderId]?.parentId;
            if (parent) {
                handleNavigate(parent);
            }
        },
        onNewFolder: handleNewFolder,
        onNewBookmark: handleNewBookmark,
        onSearch: () => {
            searchInputRef.current?.focus();
        },
    });

    return (
        <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-slate-900">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-white focus:text-gray-900 dark:focus:bg-gray-900 dark:focus:text-white focus:ring-2 focus:ring-primary-500"
            >
                {t('aria.skipToContent')}
            </a>
            {/* 顶部导航 */}
            <Header
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchInputRef={searchInputRef}
                theme={theme}
                onThemeChange={setTheme}
                locale={locale}
                onLocaleChange={handleLocaleChange}
                sidebarOpen={sidebarOpen}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
                inspectorOpen={inspectorOpen}
                onInspectorToggle={() => setInspectorOpen(!inspectorOpen)}
                selectedCount={selection.selectedIds.size}
                onNewFolder={handleNewFolder}
                onNewBookmark={handleNewBookmark}
                onImport={handleImport}
                onExport={handleExport}
            />

            <DndContext
                sensors={sensors}
                collisionDetection={collisionDetection}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                {/* 主内容区域 */}
                <div
                    className="flex flex-1 overflow-hidden relative"
                    ref={layoutRef}
                    style={{ '--sidebar-width': `${sidebarWidth}px`, '--inspector-width': `${inspectorWidth}px` } as CSSProperties}
                >
                    {/* 侧边栏 */}
                    {sidebarOpen && (
                        <>
                            <div
                                className="fixed inset-0 bg-black/30 z-30 sm:hidden"
                                onClick={() => setSidebarOpen(false)}
                                aria-hidden="true"
                            />
                            <div className="fixed inset-y-0 left-0 z-40 w-60 sm:static sm:z-auto sm:w-[var(--sidebar-width)]">
                                <Sidebar
                                    nodes={nodes}
                                    rootId="root"
                                    currentFolderId={currentFolderId}
                                    expandedFolders={expandedFolders}
                                    onFolderClick={handleFolderClick}
                                    onToggleExpand={handleToggleExpand}
                                    onNewFolder={handleNewFolder}
                                    onOpenSettings={() => setSettingsOpen(true)}
                                    onNavigateToFavorites={handleNavigateToFavorites}
                                    onNavigateToReadLater={handleNavigateToReadLater}
                                    onNavigateToTrash={handleNavigateToTrash}
                                    currentView={currentView}
                                />
                            </div>
                            <PanelResizer onResize={handleSidebarResize} ariaLabel={t('aria.resizeSidebar')} />
                        </>
                    )}
                    {/* 主区域 */}
                    <main id="main" tabIndex={-1} className="flex-1 flex flex-col bg-white dark:bg-slate-900 relative">
                        {/* 工具栏 */}
                        <Toolbar
                            breadcrumbs={breadcrumbs}
                            onNavigate={handleNavigate}
                            onDelete={handleDelete}
                            selectedCount={selection.selectedIds.size}
                            onSelectAll={selection.selectAll}
                            onClearSelection={selection.clearSelection}
                            onInvertSelection={selection.invertSelection}
                            selectionMode={selectionMode}
                            onToggleSelectionMode={() => setSelectionMode((prev) => !prev)}
                            onUndo={history.undo}
                            onRedo={history.redo}
                            canUndo={history.canUndo}
                            canRedo={history.canRedo}
                            viewMode={activeViewMode}
                            onViewModeChange={handleViewModeChange}
                            sortField={sortField}
                            sortOrder={sortOrder}
                            onSortChange={handleSortChange}
                        />

                        <div className="flex flex-1 overflow-hidden relative">
                            {/* 内容列表 */}
                            <div className="flex-1 min-w-0">
                                <ContentArea
                                    nodes={visibleNodes}
                                    allNodes={nodes}
                                    folderId={currentFolderId}
                                    viewMode={activeViewMode}
                                    isDragging={!!activeDragId}
                                    isSortable={isSortableView}
                                    selectionMode={selectionMode}
                                    selectedIds={selection.selectedIds}
                                    renamingId={renamingId}
                                    searchQuery={searchQuery}
                                    cardFolderPreviewSize={cardFolderPreviewSize}
                                    cardColumnsDesktop={cardColumnsDesktop}
                                    cardColumnsMobile={cardColumnsMobile}
                                    tileColumnsDesktop={tileColumnsDesktop}
                                    tileColumnsMobile={tileColumnsMobile}
                                    onCardColumnsDesktopChange={handleCardColumnsDesktopChange}
                                    onCardColumnsMobileChange={handleCardColumnsMobileChange}
                                    onTileColumnsDesktopChange={handleTileColumnsDesktopChange}
                                    onTileColumnsMobileChange={handleTileColumnsMobileChange}
                                    onPrimaryAction={handlePrimaryAction}
                                    singleClickAction={singleClickAction}
                                    onSelect={handleSelect}
                                    onDoubleClick={handleDoubleClick}
                                    onClearSelection={selection.clearSelection}
                                    onRenameSubmit={handleRenameSubmit}
                                    onRenameCancel={handleRenameCancel}
                                />
                            </div>

                            {/* 属性面板 */}
                            {inspectorOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 bg-black/30 z-30 sm:hidden"
                                        onClick={() => setInspectorOpen(false)}
                                        aria-hidden="true"
                                    />
                                    <PanelResizer onResize={handleInspectorResize} ariaLabel={t('aria.resizeInspector')} />
                                </>
                            )}
                            <div
                                className={cn(
                                    'fixed inset-y-0 right-0 z-40 w-[min(88vw,24rem)] overflow-hidden transition-transform duration-200 ease-out',
                                    'sm:static sm:z-auto sm:h-full sm:transition-[width] sm:duration-200 sm:ease-out',
                                    inspectorOpen
                                        ? 'translate-x-0 sm:w-[var(--inspector-width)] pointer-events-auto'
                                        : 'translate-x-full sm:w-0 pointer-events-none'
                                )}
                            >
                                <div
                                    className="h-full transition-opacity duration-200"
                                    style={{
                                        opacity: inspectorOpen ? 1 : 0,
                                        pointerEvents: inspectorOpen ? 'auto' : 'none',
                                    }}
                                >
                                    <Inspector
                                        nodes={nodes}
                                        selectedIds={selection.selectedIds}
                                        fallbackId={currentView === 'bookmarks' ? currentFolderId : undefined}
                                        customColors={customColors}
                                        onUpdate={handleUpdateNode}
                                        onClose={() => setInspectorOpen(false)}
                                        onAddCustomColor={handleAddCustomColor}
                                    />
                                </div>
                            </div>
                        </div>
                    </main>
                </div>

                <DragOverlay>
                    {activeDragId ? (
                        <div className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-white/10">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                {nodes[activeDragId]?.title || ''}
                            </span>
                        </div>
                    ) : null}
                </DragOverlay>

                {/* Floating Selection Toolbar */}
                <SelectionToolbar
                    selectedCount={selection.selectedIds.size}
                    currentView={currentView}
                    onFavorite={handleFavorite}
                    onReadLater={handleReadLater}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                    onClear={selection.clearSelection}
                />

                {/* Settings Modal */}
                <SettingsModal
                    isOpen={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    theme={theme}
                    onThemeChange={setTheme}
                    locale={locale}
                    onLocaleChange={handleLocaleChange}
                    autoExpandTree={autoExpandTree}
                    onAutoExpandTreeChange={handleAutoExpandTreeChange}
                    cardFolderPreviewSize={cardFolderPreviewSize}
                    onCardFolderPreviewSizeChange={handleCardFolderPreviewSizeChange}
                    defaultViewMode={defaultViewMode}
                    onDefaultViewModeChange={handleDefaultViewModeChange}
                    rememberFolderView={rememberFolderView}
                    onRememberFolderViewChange={handleRememberFolderViewChange}
                    themeColor={themeColor}
                    onThemeColorChange={handleThemeColorChange}
                    singleClickAction={singleClickAction}
                    onSingleClickActionChange={handleSingleClickActionChange}
                    activeViewMode={activeViewMode}
                    cardColumnsDesktop={cardColumnsDesktop}
                    cardColumnsMobile={cardColumnsMobile}
                    tileColumnsDesktop={tileColumnsDesktop}
                    tileColumnsMobile={tileColumnsMobile}
                    onCardColumnsDesktopChange={handleCardColumnsDesktopChange}
                    onCardColumnsMobileChange={handleCardColumnsMobileChange}
                    onTileColumnsDesktopChange={handleTileColumnsDesktopChange}
                    onTileColumnsMobileChange={handleTileColumnsMobileChange}
                    onClearData={() => setClearDataConfirmOpen(true)}
                />

                <Modal
                    isOpen={deleteConfirmOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            setDeleteConfirmOpen(false);
                            setDeleteConfirmIds([]);
                        }
                    }}
                >
                    <Modal.Backdrop variant="blur">
                        <Modal.Container size="sm">
                            <Modal.Dialog>
                                <Modal.Header className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <Icon icon="lucide:trash-2" className="w-5 h-5" />
                                        {t('dialog.delete')}
                                    </div>
                                </Modal.Header>
                                <Modal.Body>
                                    <p className="text-sm text-gray-700 dark:text-gray-200">
                                        {t('dialog.deleteConfirm', { count: deleteConfirmIds.length })}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                        {t('dialog.deleteWarning')}
                                    </p>
                                </Modal.Body>
                                <Modal.Footer>
                                    <Button
                                        variant="tertiary"
                                        onPress={() => {
                                            setDeleteConfirmOpen(false);
                                            setDeleteConfirmIds([]);
                                        }}
                                    >
                                        {t('dialog.cancel')}
                                    </Button>
                                    <Button variant="danger" onPress={handleConfirmDelete}>
                                        {t('dialog.delete')}
                                    </Button>
                                </Modal.Footer>
                            </Modal.Dialog>
                        </Modal.Container>
                    </Modal.Backdrop>
                </Modal>

                <Modal
                    isOpen={clearDataConfirmOpen}
                    onOpenChange={(open) => {
                        if (!open) setClearDataConfirmOpen(false);
                    }}
                >
                    <Modal.Backdrop variant="blur">
                        <Modal.Container size="sm">
                            <Modal.Dialog>
                                <Modal.Header className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <Icon icon="lucide:trash-2" className="w-5 h-5" />
                                        {t('dialog.clearData')}
                                    </div>
                                </Modal.Header>
                                <Modal.Body>
                                    <p className="text-sm text-gray-700 dark:text-gray-200">
                                        {t('dialog.clearDataConfirm')}
                                    </p>
                                    <p className="text-xs text-red-500 dark:text-red-400">
                                        {t('dialog.clearDataSaveWarning')}
                                    </p>
                                </Modal.Body>
                                <Modal.Footer>
                                    <Button variant="tertiary" onPress={() => setClearDataConfirmOpen(false)}>
                                        {t('dialog.cancel')}
                                    </Button>
                                    <Button variant="danger" onPress={handleConfirmClearData}>
                                        {t('dialog.clearData')}
                                    </Button>
                                </Modal.Footer>
                            </Modal.Dialog>
                        </Modal.Container>
                    </Modal.Backdrop>
                </Modal>
            </DndContext>
        </div>
    );
}

export default App;
