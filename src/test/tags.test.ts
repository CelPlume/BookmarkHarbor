/**
 * 标签索引与筛选测试
 */

import { describe, it, expect } from 'vitest';
import { collectTagCounts, filterByTags, normalizeTag, appendTag, removeTag } from '../core/tags';
import type { Node } from '../core/types';

function bookmark(id: string, tags?: string[], overrides: Partial<Node> = {}): Node {
    return {
        id,
        type: 'bookmark',
        parentId: 'root',
        title: `书签 ${id}`,
        url: `https://example.com/${id}`,
        orderKey: id,
        tags,
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

function folder(id: string, tags?: string[]): Node {
    return {
        id,
        type: 'folder',
        parentId: 'root',
        title: `文件夹 ${id}`,
        orderKey: id,
        tags,
        createdAt: 0,
        updatedAt: 0,
    };
}

describe('collectTagCounts', () => {
    it('统计每个标签下的书签数量', () => {
        const nodes = {
            a: bookmark('a', ['前端', '工具']),
            b: bookmark('b', ['前端']),
            c: bookmark('c', ['前端', '工具']),
        };

        expect(collectTagCounts(nodes)).toEqual([
            ['前端', 3],
            ['工具', 2],
        ]);
    });

    it('忽略文件夹上的标签', () => {
        const nodes = {
            a: bookmark('a', ['前端']),
            f: folder('f', ['前端']),
        };

        expect(collectTagCounts(nodes)).toEqual([['前端', 1]]);
    });

    it('忽略已软删除的书签', () => {
        const nodes = {
            a: bookmark('a', ['前端']),
            b: bookmark('b', ['前端'], { deletedAt: 123 }),
        };

        expect(collectTagCounts(nodes)).toEqual([['前端', 1]]);
    });

    it('数量相同时按名称升序，保证顺序稳定', () => {
        const nodes = {
            a: bookmark('a', ['乙', '甲']),
        };

        expect(collectTagCounts(nodes)).toEqual([
            ['甲', 1],
            ['乙', 1],
        ]);
    });

    it('没有标签时返回空数组', () => {
        expect(collectTagCounts({ a: bookmark('a') })).toEqual([]);
    });
});

describe('filterByTags', () => {
    it('单个标签返回全部带该标签的书签', () => {
        const nodes = {
            a: bookmark('a', ['前端']),
            b: bookmark('b', ['后端']),
            c: bookmark('c', ['前端', '工具']),
        };

        expect(filterByTags(nodes, ['前端']).map(n => n.id)).toEqual(['a', 'c']);
    });

    it('多个标签取交集', () => {
        const nodes = {
            a: bookmark('a', ['前端', '工具']),
            b: bookmark('b', ['前端']),
            c: bookmark('c', ['工具']),
        };

        expect(filterByTags(nodes, ['前端', '工具']).map(n => n.id)).toEqual(['a']);
    });

    it('交集为空时返回空数组', () => {
        const nodes = {
            a: bookmark('a', ['前端']),
            b: bookmark('b', ['后端']),
        };

        expect(filterByTags(nodes, ['前端', '后端'])).toEqual([]);
    });

    it('空标签列表返回空数组，而不是全集', () => {
        const nodes = { a: bookmark('a', ['前端']) };

        expect(filterByTags(nodes, [])).toEqual([]);
    });

    it('排除文件夹、root 与已删除书签', () => {
        const nodes = {
            a: bookmark('a', ['前端']),
            b: bookmark('b', ['前端'], { deletedAt: 1 }),
            f: folder('f', ['前端']),
            root: folder('root', ['前端']),
        };

        expect(filterByTags(nodes, ['前端']).map(n => n.id)).toEqual(['a']);
    });

    it('结果按 orderKey 排序', () => {
        const nodes = {
            c: bookmark('c', ['前端'], { orderKey: 'a3' }),
            a: bookmark('a', ['前端'], { orderKey: 'a1' }),
            b: bookmark('b', ['前端'], { orderKey: 'a2' }),
        };

        expect(filterByTags(nodes, ['前端']).map(n => n.id)).toEqual(['a', 'b', 'c']);
    });
});

describe('normalizeTag', () => {
    it('去掉首尾空白', () => {
        expect(normalizeTag('  前端  ')).toBe('前端');
    });

    it('纯空白返回 null', () => {
        expect(normalizeTag('   ')).toBeNull();
        expect(normalizeTag('')).toBeNull();
    });
});

describe('appendTag', () => {
    it('追加到空列表', () => {
        expect(appendTag(undefined, '前端')).toEqual(['前端']);
    });

    it('保持录入顺序', () => {
        expect(appendTag(['甲'], '乙')).toEqual(['甲', '乙']);
    });

    it('重复标签不重复添加', () => {
        const existing = ['前端'];
        expect(appendTag(existing, '前端')).toBe(existing);
    });
});

describe('removeTag', () => {
    it('移除指定标签', () => {
        expect(removeTag(['甲', '乙'], '甲')).toEqual(['乙']);
    });

    it('移除后为空则返回 undefined，便于清除存储字段', () => {
        expect(removeTag(['甲'], '甲')).toBeUndefined();
    });

    it('移除不存在的标签时保持原样', () => {
        expect(removeTag(['甲'], '乙')).toEqual(['甲']);
    });

    it('处理 undefined 输入', () => {
        expect(removeTag(undefined, '甲')).toBeUndefined();
    });
});
