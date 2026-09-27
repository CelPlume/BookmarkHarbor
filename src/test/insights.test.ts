/**
 * 书签体检测试
 */

import { describe, it, expect } from 'vitest';
import {
    STALE_DAYS,
    listBookmarks,
    isStale,
    buildLibraryReport,
    describeLastUse,
    listPinned,
} from '../core/insights';
import type { Node } from '../core/types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function bookmark(id: string, overrides: Partial<Node> = {}): Node {
    return {
        id,
        type: 'bookmark',
        parentId: 'root',
        title: `书签 ${id}`,
        url: `https://example.com/${id}`,
        orderKey: id,
        createdAt: NOW - 400 * DAY,
        updatedAt: NOW - 400 * DAY,
        ...overrides,
    };
}

function folder(id: string): Node {
    return {
        id,
        type: 'folder',
        parentId: 'root',
        title: `文件夹 ${id}`,
        orderKey: id,
        createdAt: NOW,
        updatedAt: NOW,
    };
}

describe('listBookmarks', () => {
    it('只取未删除的书签', () => {
        const nodes = {
            a: bookmark('a'),
            b: bookmark('b', { deletedAt: NOW }),
            f: folder('f'),
        };
        expect(listBookmarks(nodes).map(n => n.id)).toEqual(['a']);
    });

    it('没有 url 的书签被排除', () => {
        const nodes = { a: bookmark('a', { url: undefined }) };
        expect(listBookmarks(nodes)).toHaveLength(0);
    });
});

describe('isStale', () => {
    it('从未打开且创建已久的算久未使用', () => {
        const node = bookmark('a', { createdAt: NOW - 400 * DAY });
        expect(isStale(node, NOW)).toBe(true);
    });

    it('从未打开但刚加进来的不算', () => {
        // 刚导入的书签不该被立刻判定为"僵尸"
        const node = bookmark('a', { createdAt: NOW - 3 * DAY });
        expect(isStale(node, NOW)).toBe(false);
    });

    it('打开过的以最后打开时间为准', () => {
        const recent = bookmark('a', { useCount: 5, lastUsedAt: NOW - 10 * DAY });
        const old = bookmark('b', { useCount: 5, lastUsedAt: NOW - 400 * DAY });

        expect(isStale(recent, NOW)).toBe(false);
        expect(isStale(old, NOW)).toBe(true);
    });

    it('创建很久但最近打开过的不算', () => {
        const node = bookmark('a', { createdAt: NOW - 800 * DAY, useCount: 1, lastUsedAt: NOW - DAY });
        expect(isStale(node, NOW)).toBe(false);
    });

    it('阈值可调', () => {
        const node = bookmark('a', { createdAt: NOW - 40 * DAY });
        // 40 天未用：30 天阈值下算久未使用，60 天阈值下不算
        expect(isStale(node, NOW, 30)).toBe(true);
        expect(isStale(node, NOW, 60)).toBe(false);
    });

    it('默认阈值为 180 天', () => {
        expect(STALE_DAYS).toBe(180);
    });
});

describe('buildLibraryReport', () => {
    const nodes = {
        // 常用
        hot: bookmark('hot', { useCount: 50, lastUsedAt: NOW - DAY }),
        // 偶尔用
        warm: bookmark('warm', { useCount: 3, lastUsedAt: NOW - 20 * DAY }),
        // 从没打开过、且收藏很久
        dead1: bookmark('dead1', { createdAt: NOW - 500 * DAY }),
        dead2: bookmark('dead2', { createdAt: NOW - 300 * DAY }),
        // 从没打开过但刚加进来
        fresh: bookmark('fresh', { createdAt: NOW - 2 * DAY }),
        // 打开过但很久没用了
        cold: bookmark('cold', { useCount: 8, lastUsedAt: NOW - 400 * DAY }),
        f: folder('f'),
    };

    it('统计书签总数，不含文件夹', () => {
        expect(buildLibraryReport(nodes, NOW).total).toBe(6);
    });

    it('分出从未使用过的', () => {
        const report = buildLibraryReport(nodes, NOW);
        expect(report.neverUsed.map(n => n.id).sort()).toEqual(['dead1', 'dead2', 'fresh']);
    });

    it('分出使用过的', () => {
        const report = buildLibraryReport(nodes, NOW);
        expect(report.used.map(n => n.id).sort()).toEqual(['cold', 'hot', 'warm']);
    });

    it('活跃占比 = 用过的 / 总数', () => {
        const report = buildLibraryReport(nodes, NOW);
        expect(report.activeRatio).toBeCloseTo(3 / 6);
    });

    it('久未使用包含从未打开且创建已久的，但不含刚加进来的', () => {
        const report = buildLibraryReport(nodes, NOW);
        const ids = report.stale.map(n => n.id).sort();
        expect(ids).toEqual(['cold', 'dead1', 'dead2']);
        expect(ids).not.toContain('fresh');
    });

    it('常用榜按次数降序', () => {
        const report = buildLibraryReport(nodes, NOW);
        expect(report.top.map(n => n.id)).toEqual(['hot', 'cold', 'warm']);
    });

    it('常用榜条数可限', () => {
        const report = buildLibraryReport(nodes, NOW, { topCount: 2 });
        expect(report.top).toHaveLength(2);
    });

    it('次数相同时按最近打开排序', () => {
        const tie = {
            a: bookmark('a', { useCount: 5, lastUsedAt: NOW - 30 * DAY }),
            b: bookmark('b', { useCount: 5, lastUsedAt: NOW - DAY }),
        };
        expect(buildLibraryReport(tie, NOW).top.map(n => n.id)).toEqual(['b', 'a']);
    });

    it('空库不报错，占比为 0', () => {
        const report = buildLibraryReport({}, NOW);
        expect(report.total).toBe(0);
        expect(report.activeRatio).toBe(0);
        expect(report.top).toEqual([]);
    });

    it('已删除的书签不计入任何统计', () => {
        const withDeleted = {
            a: bookmark('a', { useCount: 10, lastUsedAt: NOW }),
            gone: bookmark('gone', { deletedAt: NOW, useCount: 10 }),
        };
        const report = buildLibraryReport(withDeleted, NOW);
        expect(report.total).toBe(1);
    });
});

describe('describeLastUse', () => {
    it('从未使用过', () => {
        expect(describeLastUse(bookmark('a'), NOW)).toBe('NEVER_USED');
    });

    it('今天 / 昨天', () => {
        expect(describeLastUse(bookmark('a', { lastUsedAt: NOW, useCount: 1 }), NOW)).toBe('TODAY');
        expect(describeLastUse(bookmark('a', { lastUsedAt: NOW - DAY, useCount: 1 }), NOW)).toBe('YESTERDAY');
    });

    it('按天数 / 月数 / 年数分档', () => {
        expect(describeLastUse(bookmark('a', { lastUsedAt: NOW - 5 * DAY, useCount: 1 }), NOW)).toBe('5D');
        expect(describeLastUse(bookmark('a', { lastUsedAt: NOW - 60 * DAY, useCount: 1 }), NOW)).toBe('2M');
        expect(describeLastUse(bookmark('a', { lastUsedAt: NOW - 400 * DAY, useCount: 1 }), NOW)).toBe('1Y');
    });
});

describe('listPinned', () => {
    it('只取固定过的书签', () => {
        const nodes = {
            a: bookmark('a', { isPinned: true }),
            b: bookmark('b'),
        };
        expect(listPinned(nodes).map(n => n.id)).toEqual(['a']);
    });

    it('按 orderKey 排序', () => {
        const nodes = {
            b: bookmark('b', { isPinned: true, orderKey: 'a2' }),
            a: bookmark('a', { isPinned: true, orderKey: 'a1' }),
        };
        expect(listPinned(nodes).map(n => n.id)).toEqual(['a', 'b']);
    });

    it('已删除的固定书签不出现', () => {
        const nodes = { a: bookmark('a', { isPinned: true, deletedAt: NOW }) };
        expect(listPinned(nodes)).toEqual([]);
    });
});
