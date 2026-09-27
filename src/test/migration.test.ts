/**
 * 存储版本迁移测试
 *
 * 迁移是升级路径上的单点故障：写错会让老用户的数据打不开。
 * 这里覆盖三件事——老数据能升上来、用户数据不丢、异常输入不崩。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// 每个用例前重置模块，避免单例 StorageAdapter 跨用例串联
let loadFromStorage: typeof import('../core/storage/localStorage').loadFromStorage;

/** 造一份 v1 时代的存储数据（没有 rules 字段） */
function legacyV1Data() {
    return {
        version: 1,
        nodes: {
            root: {
                id: 'root',
                type: 'folder',
                parentId: null,
                title: 'All Bookmarks',
                orderKey: 'a0',
                createdAt: 1000,
                updatedAt: 1000,
            },
            b1: {
                id: 'b1',
                type: 'bookmark',
                parentId: 'root',
                title: '老书签',
                url: 'https://example.com',
                orderKey: 'a1',
                tags: ['旧标签'],
                notes: '旧备注',
                createdAt: 2000,
                updatedAt: 2000,
            },
        },
        assets: {},
        metadataCache: {},
        settings: {
            theme: 'dark',
            locale: 'en',
            viewMode: 'card',
            sidebarOpen: false,
            autoExpandTree: true,
            cardFolderPreviewSize: '3x3',
            customColors: ['#ff0000'],
            defaultViewMode: 'list',
            rememberFolderView: true,
            folderViewModes: {},
            themeColor: '#123456',
            singleClickAction: 'open',
            cardColumnsDesktop: 5,
            cardColumnsMobile: 3,
            tileColumnsDesktop: 6,
            tileColumnsMobile: 2,
        },
    };
}

beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../core/storage/localStorage');
    loadFromStorage = mod.loadFromStorage;
    localStorage.clear();
});

describe('版本迁移', () => {
    it('v1 数据升到当前版本', () => {
        localStorage.setItem('aurabookmarks_data', JSON.stringify(legacyV1Data()));
        const data = loadFromStorage();

        expect(data.version).toBe(2);
    });

    it('迁移补齐 rules 字段', () => {
        localStorage.setItem('aurabookmarks_data', JSON.stringify(legacyV1Data()));
        const data = loadFromStorage();

        expect(Array.isArray(data.rules)).toBe(true);
        expect(data.rules).toEqual([]);
    });

    it('迁移不丢书签数据', () => {
        localStorage.setItem('aurabookmarks_data', JSON.stringify(legacyV1Data()));
        const data = loadFromStorage();

        expect(Object.keys(data.nodes)).toHaveLength(2);
        expect(data.nodes.b1.title).toBe('老书签');
        expect(data.nodes.b1.url).toBe('https://example.com');
    });

    it('迁移不丢标签与备注（这些字段曾经只在导入导出链路里用）', () => {
        localStorage.setItem('aurabookmarks_data', JSON.stringify(legacyV1Data()));
        const data = loadFromStorage();

        expect(data.nodes.b1.tags).toEqual(['旧标签']);
        expect(data.nodes.b1.notes).toBe('旧备注');
    });

    it('迁移不丢用户设置', () => {
        localStorage.setItem('aurabookmarks_data', JSON.stringify(legacyV1Data()));
        const data = loadFromStorage();

        expect(data.settings.theme).toBe('dark');
        expect(data.settings.locale).toBe('en');
        expect(data.settings.themeColor).toBe('#123456');
        expect(data.settings.singleClickAction).toBe('open');
        expect(data.settings.cardColumnsDesktop).toBe(5);
        expect(data.settings.customColors).toEqual(['#ff0000']);
    });

    it('缺少 version 字段时按当前版本处理，不误跑迁移', () => {
        const noVersion = legacyV1Data() as Record<string, unknown>;
        delete noVersion.version;
        localStorage.setItem('aurabookmarks_data', JSON.stringify(noVersion));

        const data = loadFromStorage();
        expect(data.version).toBe(2);
        expect(Array.isArray(data.rules)).toBe(true);
    });

    it('版本号高于当前程序时不动数据（用户降级场景）', () => {
        const future = { ...legacyV1Data(), version: 99, rules: [{ id: 'keep-me' }] };
        localStorage.setItem('aurabookmarks_data', JSON.stringify(future));

        const data = loadFromStorage();
        // 不把 99 降级改写
        expect(data.version).toBe(99);
        expect(data.rules).toHaveLength(1);
    });

    it('存储为空时返回默认数据', () => {
        const data = loadFromStorage();
        expect(data.version).toBe(2);
        expect(data.rules).toEqual([]);
        expect(data.nodes.root).toBeDefined();
    });

    it('存储内容损坏时回退到默认数据，不抛异常', () => {
        localStorage.setItem('aurabookmarks_data', '{ 这不是合法 JSON');
        const data = loadFromStorage();

        expect(data.version).toBe(2);
        expect(data.nodes.root).toBeDefined();
    });

    it('rules 字段类型错误时兜底为空数组', () => {
        const bad = { ...legacyV1Data(), version: 2, rules: '不是数组' };
        localStorage.setItem('aurabookmarks_data', JSON.stringify(bad));

        const data = loadFromStorage();
        expect(Array.isArray(data.rules)).toBe(true);
    });
});
