/**
 * 多字段加权检索测试
 */

import { describe, it, expect } from 'vitest';
import {
    parseQuery,
    isQueryEmpty,
    matchNode,
    searchNodes,
    getPinyinIndex,
} from '../core/search';
import type { Node } from '../core/types';

function bookmark(id: string, overrides: Partial<Node> = {}): Node {
    return {
        id,
        type: 'bookmark',
        parentId: 'root',
        title: `书签 ${id}`,
        url: `https://example.com/${id}`,
        orderKey: id,
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

describe('parseQuery', () => {
    it('普通关键字按空格切分', () => {
        expect(parseQuery('前端 工具').terms).toEqual(['前端', '工具']);
    });

    it('解析 tag: 条件并小写化', () => {
        expect(parseQuery('tag:前端').tags).toEqual(['前端']);
        expect(parseQuery('tag:React').tags).toEqual(['react']);
    });

    it('解析 site: 条件', () => {
        expect(parseQuery('site:github.com').sites).toEqual(['github.com']);
    });

    it('解析 is:fav 与 is:later', () => {
        const q = parseQuery('is:fav is:later');
        expect(q.favorite).toBe(true);
        expect(q.readLater).toBe(true);
        expect(q.terms).toEqual([]);
    });

    it('关键字与过滤条件可混用', () => {
        const q = parseQuery('tag:前端 is:fav 教程');
        expect(q.tags).toEqual(['前端']);
        expect(q.favorite).toBe(true);
        expect(q.terms).toEqual(['教程']);
    });

    it('无法识别的冒号片段按普通关键字处理，不报错', () => {
        const q = parseQuery('foo:bar');
        expect(q.terms).toEqual(['foo:bar']);
    });

    it('空串解析为空查询', () => {
        expect(isQueryEmpty(parseQuery(''))).toBe(true);
        expect(isQueryEmpty(parseQuery('   '))).toBe(true);
    });
});

describe('getPinyinIndex', () => {
    it('中文标题得到全拼与首字母', () => {
        const { full, initials } = getPinyinIndex('前端开发');
        expect(full).toBe('qianduankaifa');
        expect(initials).toBe('qdkf');
    });

    it('英文标题原样保留', () => {
        const { full } = getPinyinIndex('GitHub');
        expect(full.toLowerCase()).toContain('github');
    });

    it('同一标题返回同一结果', () => {
        expect(getPinyinIndex('测试')).toEqual(getPinyinIndex('测试'));
    });
});

describe('matchNode 关键字匹配', () => {
    it('原文命中标题', () => {
        const m = matchNode(bookmark('a', { title: '前端开发' }), parseQuery('前端'));
        expect(m?.field).toBe('title');
    });

    it('首字母命中：qdkf 匹配"前端开发"', () => {
        const m = matchNode(bookmark('a', { title: '前端开发' }), parseQuery('qdkf'));
        expect(m).not.toBeNull();
        expect(m?.field).toBe('initial');
    });

    it('全拼命中', () => {
        const m = matchNode(bookmark('a', { title: '前端开发' }), parseQuery('qianduan'));
        expect(m?.field).toBe('pinyin');
    });

    it('标签命中', () => {
        const m = matchNode(
            bookmark('a', { title: '随便', tags: ['前端'] }),
            parseQuery('前端')
        );
        expect(m?.field).toBe('tag');
    });

    it('网址命中', () => {
        const m = matchNode(
            bookmark('a', { title: '随便', url: 'https://github.com/x' }),
            parseQuery('github')
        );
        expect(m?.field).toBe('url');
    });

    it('备注命中（权重最低）', () => {
        const m = matchNode(
            bookmark('a', { title: '随便', notes: '记得看这个' }),
            parseQuery('记得')
        );
        expect(m?.field).toBe('notes');
    });

    it('多个关键字取交集：有一个不命中就返回 null', () => {
        const node = bookmark('a', { title: '前端开发' });
        expect(matchNode(node, parseQuery('前端 不存在的词'))).toBeNull();
    });

    it('已软删除的节点不参与匹配', () => {
        const node = bookmark('a', { title: '前端', deletedAt: 1 });
        expect(matchNode(node, parseQuery('前端'))).toBeNull();
    });
});

describe('matchNode 过滤条件', () => {
    it('is:fav 只留收藏的', () => {
        expect(matchNode(bookmark('a', { isFavorite: false }), parseQuery('is:fav'))).toBeNull();
        expect(matchNode(bookmark('a', { isFavorite: true }), parseQuery('is:fav'))).not.toBeNull();
    });

    it('is:later 只留稍后阅读的', () => {
        expect(matchNode(bookmark('a'), parseQuery('is:later'))).toBeNull();
        expect(matchNode(bookmark('a', { isReadLater: true }), parseQuery('is:later'))).not.toBeNull();
    });

    it('tag: 条件按标签过滤', () => {
        expect(matchNode(bookmark('a', { tags: ['甲'] }), parseQuery('tag:甲'))).not.toBeNull();
        expect(matchNode(bookmark('b', { tags: ['乙'] }), parseQuery('tag:甲'))).toBeNull();
    });

    it('多个 tag: 取交集', () => {
        const node = bookmark('a', { tags: ['甲', '乙'] });
        expect(matchNode(node, parseQuery('tag:甲 tag:乙'))).not.toBeNull();
        expect(matchNode(node, parseQuery('tag:甲 tag:丙'))).toBeNull();
    });

    it('site: 按域名过滤', () => {
        const node = bookmark('a', { url: 'https://github.com/x' });
        expect(matchNode(node, parseQuery('site:github'))).not.toBeNull();
        expect(matchNode(node, parseQuery('site:gitlab'))).toBeNull();
    });

    it('没有网址时 site: 条件不命中', () => {
        expect(matchNode(bookmark('a', { url: undefined }), parseQuery('site:github'))).toBeNull();
    });

    it('只有过滤条件、无关键字时仍算命中', () => {
        const node = bookmark('a', { isFavorite: true });
        const m = matchNode(node, parseQuery('is:fav'));
        expect(m).not.toBeNull();
    });
});

describe('searchNodes 排序', () => {
    it('原文命中排在拼音命中之前', () => {
        const nodes = [
            bookmark('a', { title: '前端开发', orderKey: 'a1' }),   // 首字母 qdkf
            bookmark('b', { title: '前端', orderKey: 'a0' }),       // 原文命中
        ];

        const result = searchNodes(nodes, parseQuery('前端'));
        expect(result.map(n => n.id)).toEqual(['b', 'a']);
    });

    it('标题命中排在网址命中之前', () => {
        const nodes = [
            bookmark('a', { title: '随便', url: 'https://github.com/x', orderKey: 'a0' }),
            bookmark('b', { title: 'github 教程', orderKey: 'a1' }),
        ];

        const result = searchNodes(nodes, parseQuery('github'));
        expect(result.map(n => n.id)).toEqual(['b', 'a']);
    });

    it('权重相同时按 orderKey 保持稳定顺序', () => {
        const nodes = [
            bookmark('a', { title: '前端乙', orderKey: 'a2' }),
            bookmark('b', { title: '前端甲', orderKey: 'a1' }),
        ];

        const result = searchNodes(nodes, parseQuery('前端'));
        expect(result.map(n => n.id)).toEqual(['b', 'a']);
    });

    it('空查询原样返回', () => {
        const nodes = [bookmark('a'), bookmark('b')];
        expect(searchNodes(nodes, parseQuery(''))).toBe(nodes);
    });

    it('无命中返回空数组', () => {
        const nodes = [bookmark('a', { title: '前端' })];
        expect(searchNodes(nodes, parseQuery('后端'))).toEqual([]);
    });
});
