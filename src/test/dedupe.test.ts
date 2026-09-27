/**
 * 重复书签检测与合并测试
 */

import { describe, it, expect } from 'vitest';
import { normalizeUrl, findDuplicateGroups, planMerge, planMergeAll } from '../core/dedupe';
import type { Node } from '../core/types';

function bookmark(id: string, url: string, overrides: Partial<Node> = {}): Node {
    return {
        id,
        type: 'bookmark',
        parentId: 'root',
        title: `书签 ${id}`,
        url,
        orderKey: id,
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

describe('normalizeUrl', () => {
    it('scheme 与 host 统一小写', () => {
        expect(normalizeUrl('HTTPS://WWW.Example.COM/Path')).toBe('https://example.com/Path');
    });

    it('http 与 https 视为同一地址', () => {
        expect(normalizeUrl('http://example.com/a')).toBe(normalizeUrl('https://example.com/a'));
    });

    it('去掉 www. 前缀', () => {
        expect(normalizeUrl('https://www.example.com/a')).toBe('https://example.com/a');
    });

    it('去掉默认端口', () => {
        expect(normalizeUrl('https://example.com:443/a')).toBe('https://example.com/a');
        expect(normalizeUrl('http://example.com:80/a')).toBe('https://example.com/a');
    });

    it('保留非默认端口', () => {
        expect(normalizeUrl('https://example.com:8080/a')).toBe('https://example.com:8080/a');
    });

    it('去掉路径末尾斜杠', () => {
        expect(normalizeUrl('https://example.com/a/')).toBe(normalizeUrl('https://example.com/a'));
    });

    it('剥离跟踪参数', () => {
        expect(normalizeUrl('https://a.com/x?utm_source=q')).toBe('https://a.com/x');
        expect(normalizeUrl('https://a.com/x?fbclid=abc')).toBe('https://a.com/x');
    });

    it('查询参数按键名排序，顺序不同视为同一地址', () => {
        expect(normalizeUrl('https://a.com/x?b=2&a=1')).toBe(normalizeUrl('https://a.com/x?a=1&b=2'));
    });

    it('保留非跟踪参数', () => {
        expect(normalizeUrl('https://a.com/x?id=7')).toBe('https://a.com/x?id=7');
    });

    it('剥离普通锚点', () => {
        expect(normalizeUrl('https://a.com/x#section')).toBe('https://a.com/x');
    });

    it('保留 #/ 哈希路由（单页应用靠它区分页面）', () => {
        expect(normalizeUrl('https://a.com/#/a')).toBe('https://a.com/#/a');
        expect(normalizeUrl('https://a.com/#/a')).not.toBe(normalizeUrl('https://a.com/#/b'));
    });

    it('保留 #! 哈希路由', () => {
        expect(normalizeUrl('https://a.com/#!/a')).toBe('https://a.com/#!/a');
    });

    it('文档给出的等价性与非等价性用例', () => {
        expect(normalizeUrl('HTTP://WWW.A.com/x/?utm_source=q#f'))
            .toBe(normalizeUrl('https://a.com/x'));
        expect(normalizeUrl('https://a.com/#/a'))
            .not.toBe(normalizeUrl('https://a.com/#/b'));
    });

    it('非 http/https 协议返回 null', () => {
        expect(normalizeUrl('javascript:alert(1)')).toBeNull();
        expect(normalizeUrl('data:text/html,x')).toBeNull();
    });

    it('无法解析的字符串返回 null', () => {
        expect(normalizeUrl('不是网址')).toBeNull();
        expect(normalizeUrl('')).toBeNull();
    });
});

describe('findDuplicateGroups', () => {
    it('把规范化后相同的书签归为一组', () => {
        const nodes = {
            a: bookmark('a', 'https://example.com/x'),
            b: bookmark('b', 'HTTP://WWW.example.com/x/?utm_source=q'),
            c: bookmark('c', 'https://other.com/y'),
        };

        const groups = findDuplicateGroups(nodes);
        expect(groups).toHaveLength(1);
        expect(groups[0].nodes.map(n => n.id)).toEqual(['a', 'b']);
    });

    it('不同哈希路由不归为一组', () => {
        const nodes = {
            a: bookmark('a', 'https://a.com/#/a'),
            b: bookmark('b', 'https://a.com/#/b'),
        };

        expect(findDuplicateGroups(nodes)).toEqual([]);
    });

    it('忽略文件夹与非书签节点', () => {
        const nodes = {
            a: bookmark('a', 'https://a.com/x'),
            f: { ...bookmark('f', 'https://a.com/x'), type: 'folder' as const },
        };

        expect(findDuplicateGroups(nodes)).toEqual([]);
    });

    it('忽略已软删除的书签', () => {
        const nodes = {
            a: bookmark('a', 'https://a.com/x'),
            b: bookmark('b', 'https://a.com/x', { deletedAt: 1 }),
        };

        expect(findDuplicateGroups(nodes)).toEqual([]);
    });

    it('忽略没有 url 或 url 无法解析的书签', () => {
        const nodes = {
            a: bookmark('a', 'https://a.com/x'),
            b: { ...bookmark('b', 'https://a.com/x'), url: undefined },
            c: bookmark('c', '不是网址'),
        };

        expect(findDuplicateGroups(nodes)).toEqual([]);
    });

    it('组内按 orderKey 排序，组间按条数降序', () => {
        const nodes = {
            a1: bookmark('a3', 'https://a.com/x', { orderKey: 'a2' }),
            a2: bookmark('a5', 'https://a.com/x', { orderKey: 'a1' }),
            b1: bookmark('b1', 'https://b.com/y'),
            b2: bookmark('b2', 'https://b.com/y'),
            b3: bookmark('b3', 'https://b.com/y'),
        };

        const groups = findDuplicateGroups(nodes);
        expect(groups[0].nodes).toHaveLength(3);
        expect(groups[1].nodes.map(n => n.orderKey)).toEqual(['a1', 'a2']);
    });
});

describe('planMerge', () => {
    const group = [
        bookmark('old', 'https://a.com/x', {
            createdAt: 100,
            updatedAt: 100,
            tags: ['甲'],
            notes: '旧备注',
        }),
        bookmark('new', 'https://a.com/x', {
            createdAt: 200,
            updatedAt: 300,
            tags: ['乙'],
            notes: '新备注',
            isFavorite: true,
        }),
    ];

    it('oldest 策略保留最早创建的', () => {
        expect(planMerge(group, 'oldest')?.keepId).toBe('old');
    });

    it('newest 策略保留最近修改的', () => {
        expect(planMerge(group, 'newest')?.keepId).toBe('new');
    });

    it('richest 策略保留信息最完整的', () => {
        const g = [
            bookmark('bare', 'https://a.com/x', { createdAt: 1 }),
            bookmark('rich', 'https://a.com/x', {
                createdAt: 2,
                coverUrl: 'https://a.com/c.png',
                iconUrl: 'https://a.com/i.png',
                notes: '有备注',
            }),
        ];
        expect(planMerge(g, 'richest')?.keepId).toBe('rich');
    });

    it('标签取并集', () => {
        const plan = planMerge(group, 'oldest')!;
        expect(plan.merged.tags).toEqual(['甲', '乙']);
    });

    it('备注非空去重拼接，保留项在前', () => {
        const plan = planMerge(group, 'oldest')!;
        expect(plan.merged.notes).toBe('旧备注\n\n新备注');
    });

    it('备注完全相同时不重复拼接', () => {
        const g = [
            bookmark('a', 'https://a.com/x', { notes: '同样的备注' }),
            bookmark('b', 'https://a.com/x', { notes: '同样的备注' }),
        ];
        expect(planMerge(g, 'oldest')?.merged.notes).toBe('同样的备注');
    });

    it('收藏与稍后阅读标记取或', () => {
        const g = [
            bookmark('a', 'https://a.com/x'),
            bookmark('b', 'https://a.com/x', { isReadLater: true }),
        ];
        const plan = planMerge(g, 'oldest')!;
        expect(plan.merged.isReadLater).toBe(true);
        expect(plan.merged.isFavorite).toBeUndefined();
    });

    it('保留项缺封面时从同组补齐', () => {
        const g = [
            bookmark('a', 'https://a.com/x', { createdAt: 1 }),
            bookmark('b', 'https://a.com/x', {
                createdAt: 2,
                coverUrl: 'https://a.com/c.png',
                coverType: 'remote',
            }),
        ];
        const plan = planMerge(g, 'oldest')!;
        expect(plan.merged.coverUrl).toBe('https://a.com/c.png');
        expect(plan.merged.coverType).toBe('remote');
    });

    it('保留项已有封面时不覆盖', () => {
        const g = [
            bookmark('a', 'https://a.com/x', { createdAt: 1, coverUrl: 'keep.png' }),
            bookmark('b', 'https://a.com/x', { createdAt: 2, coverUrl: 'other.png' }),
        ];
        expect(planMerge(g, 'oldest')?.merged.coverUrl).toBeUndefined();
    });

    it('其余节点列入待删除', () => {
        expect(planMerge(group, 'oldest')?.removeIds).toEqual(['new']);
    });

    it('少于两个节点时不生成方案', () => {
        expect(planMerge([group[0]], 'oldest')).toBeNull();
        expect(planMerge([], 'oldest')).toBeNull();
    });
});

describe('planMergeAll', () => {
    it('为每个分组各生成一个方案', () => {
        const nodes = {
            a1: bookmark('a1', 'https://a.com/x'),
            a2: bookmark('a2', 'https://a.com/x'),
            b1: bookmark('b1', 'https://b.com/y'),
            b2: bookmark('b2', 'https://b.com/y'),
        };

        const plans = planMergeAll(findDuplicateGroups(nodes));
        expect(plans).toHaveLength(2);
        expect(plans.every(p => p.removeIds.length === 1)).toBe(true);
    });

    it('没有重复时返回空数组', () => {
        expect(planMergeAll([])).toEqual([]);
    });
});
