/**
 * 规则化自动整理测试
 */

import { describe, it, expect } from 'vitest';
import {
    validateRegex,
    validateRuleRegexes,
    matchesCondition,
    hasAnyCondition,
    hasAnyAction,
    planOrganize,
    isValidTargetFolder,
    MAX_REGEX_LENGTH,
} from '../core/rules';
import type { AutoOrganizeRule, Node } from '../core/types';

function bookmark(id: string, overrides: Partial<Node> = {}): Node {
    return {
        id,
        type: 'bookmark',
        parentId: 'root',
        title: `书签 ${id}`,
        url: `https://example.com/${id}`,
        orderKey: id,
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides,
    };
}

function folder(id: string, overrides: Partial<Node> = {}): Node {
    return {
        id,
        type: 'folder',
        parentId: 'root',
        title: `文件夹 ${id}`,
        orderKey: id,
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides,
    };
}

function rule(id: string, priority: number, overrides: Partial<AutoOrganizeRule> = {}): AutoOrganizeRule {
    return {
        id,
        name: `规则 ${id}`,
        enabled: true,
        priority,
        when: { domainContains: 'github.com' },
        then: { addTags: ['开发'] },
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

describe('validateRegex', () => {
    it('合法正则返回 null', () => {
        expect(validateRegex('^https?://')).toBeNull();
        expect(validateRegex('')).toBeNull();
    });

    it('非法正则返回错误说明', () => {
        expect(validateRegex('([unclosed')).not.toBeNull();
        expect(validateRegex('a{2,1}')).not.toBeNull();
    });

    it('超长正则被拒绝', () => {
        const long = 'a'.repeat(MAX_REGEX_LENGTH + 1);
        expect(validateRegex(long)).toContain('过长');
    });

    it('正好达到长度上限时允许', () => {
        expect(validateRegex('a'.repeat(MAX_REGEX_LENGTH))).toBeNull();
    });
});

describe('validateRuleRegexes', () => {
    it('两个正则都合法时返回空数组', () => {
        expect(validateRuleRegexes({ when: { titleRegex: '^a', urlRegex: 'b$' } })).toEqual([]);
    });

    it('分别指出是哪个字段出的问题', () => {
        const problems = validateRuleRegexes({ when: { titleRegex: '(', urlRegex: '[' } });
        expect(problems).toHaveLength(2);
        expect(problems[0]).toContain('标题正则');
        expect(problems[1]).toContain('网址正则');
    });
});

describe('matchesCondition', () => {
    it('域名包含匹配，忽略大小写', () => {
        const node = bookmark('a', { url: 'https://GitHub.com/x' });
        expect(matchesCondition(node, { domainContains: 'github.com' })).toBe(true);
        expect(matchesCondition(node, { domainContains: 'gitlab.com' })).toBe(false);
    });

    it('网址无法解析时域名条件不命中', () => {
        expect(matchesCondition(bookmark('a', { url: '不是网址' }), { domainContains: 'a' })).toBe(false);
        expect(matchesCondition(bookmark('a', { url: undefined }), { domainContains: 'a' })).toBe(false);
    });

    it('标题正则匹配', () => {
        const node = bookmark('a', { title: '教程：TypeScript 入门' });
        expect(matchesCondition(node, { titleRegex: '教程' })).toBe(true);
        expect(matchesCondition(node, { titleRegex: '^入门' })).toBe(false);
    });

    it('网址正则匹配', () => {
        const node = bookmark('a', { url: 'https://example.com/docs/intro' });
        expect(matchesCondition(node, { urlRegex: '/docs/' })).toBe(true);
        expect(matchesCondition(node, { urlRegex: '/blog/' })).toBe(false);
    });

    it('创建时间区间', () => {
        const node = bookmark('a', { createdAt: 5000 });
        expect(matchesCondition(node, { createdBefore: 6000 })).toBe(true);
        expect(matchesCondition(node, { createdBefore: 4000 })).toBe(false);
        expect(matchesCondition(node, { createdAfter: 4000 })).toBe(true);
        expect(matchesCondition(node, { createdAfter: 6000 })).toBe(false);
    });

    it('标签取交集之一（tagIn 是"含其中任意一个"）', () => {
        const node = bookmark('a', { tags: ['前端', '工具'] });
        expect(matchesCondition(node, { tagIn: ['前端'] })).toBe(true);
        expect(matchesCondition(node, { tagIn: ['后端', '工具'] })).toBe(true);
        expect(matchesCondition(node, { tagIn: ['后端'] })).toBe(false);
    });

    it('多个条件之间是"与"关系', () => {
        const node = bookmark('a', { url: 'https://github.com/x', title: '教程' });
        expect(matchesCondition(node, { domainContains: 'github.com', titleRegex: '教程' })).toBe(true);
        expect(matchesCondition(node, { domainContains: 'github.com', titleRegex: '手册' })).toBe(false);
    });

    it('未填写的条件不参与判断', () => {
        expect(matchesCondition(bookmark('a'), {})).toBe(true);
    });

    it('已软删除的节点不参与匹配', () => {
        expect(matchesCondition(bookmark('a', { deletedAt: 1 }), {})).toBe(false);
    });
});

describe('hasAnyCondition / hasAnyAction', () => {
    it('空条件是"没有条件"', () => {
        expect(hasAnyCondition({})).toBe(false);
        expect(hasAnyCondition({ domainContains: 'a' })).toBe(true);
        expect(hasAnyCondition({ tagIn: [] })).toBe(false);
        expect(hasAnyCondition({ tagIn: ['x'] })).toBe(true);
    });

    it('空动作是"没有动作"', () => {
        expect(hasAnyAction({})).toBe(false);
        expect(hasAnyAction({ addTags: [] })).toBe(false);
        expect(hasAnyAction({ setFavorite: true })).toBe(true);
        expect(hasAnyAction({ moveToFolderId: 'f1' })).toBe(true);
    });
});

describe('planOrganize 优先级命中顺序', () => {
    const nodes = {
        gh: bookmark('gh', { url: 'https://github.com/a/b', title: '仓库' }),
        other: bookmark('other', { url: 'https://example.com/x', title: '别的' }),
    };

    it('按 priority 升序匹配，先命中者决定移动目标', () => {
        const rules = [
            rule('low', 10, {
                when: { domainContains: 'github.com' },
                then: { moveToFolderId: 'folder-late' },
            }),
            rule('high', 1, {
                when: { domainContains: 'github.com' },
                then: { moveToFolderId: 'folder-early' },
            }),
        ];

        const preview = planOrganize(nodes, rules);
        const move = preview.moves.find(m => m.id === 'gh');
        expect(move?.toFolderId).toBe('folder-early');
    });

    it('continueMatching 为 true 时后续规则继续叠加', () => {
        const rules = [
            rule('a', 1, { when: { domainContains: 'github.com' }, then: { addTags: ['开发'] }, continueMatching: true }),
            rule('b', 2, { when: { domainContains: 'github.com' }, then: { addTags: ['收藏'] }, continueMatching: true }),
        ];

        const preview = planOrganize(nodes, rules);
        const patch = preview.patches.find(p => p.id === 'gh');
        expect(patch?.patch.tags).toEqual(['开发', '收藏']);
    });

    it('未标记 continueMatching 时同一节点只被处理一次', () => {
        const rules = [
            rule('a', 1, { when: { domainContains: 'github.com' }, then: { addTags: ['开发'] } }),
            rule('b', 2, { when: { domainContains: 'github.com' }, then: { addTags: ['收藏'] } }),
        ];

        const preview = planOrganize(nodes, rules);
        const patch = preview.patches.find(p => p.id === 'gh');
        expect(patch?.patch.tags).toEqual(['开发']);
        // 第二条规则对该节点没有命中
        const detailB = preview.details.find(d => d.ruleId === 'b');
        expect(detailB).toBeUndefined();
    });

    it('标签与已有标签取并集', () => {
        const withTags = { gh: bookmark('gh', { url: 'https://github.com/a', tags: ['已有'] }) };
        const preview = planOrganize(withTags, [rule('a', 1, { then: { addTags: ['新增'] } })]);
        expect(preview.patches[0].patch.tags).toEqual(['已有', '新增']);
    });
});

describe('planOrganize 预览数量与实际一致', () => {
    const nodes = {
        gh1: bookmark('gh1', { url: 'https://github.com/a' }),
        gh2: bookmark('gh2', { url: 'https://github.com/b' }),
        other: bookmark('other', { url: 'https://example.com/x' }),
        f1: folder('f1'),
    };

    it('只统计会被改动的书签', () => {
        const preview = planOrganize(nodes, [
            rule('a', 1, { when: { domainContains: 'github.com' }, then: { addTags: ['开发'] } }),
        ]);

        expect(preview.affectedCount).toBe(2);
        expect(preview.patches).toHaveLength(2);
        expect(preview.patches.map(p => p.id).sort()).toEqual(['gh1', 'gh2']);
    });

    it('文件夹不参与整理', () => {
        const preview = planOrganize(nodes, [
            rule('a', 1, { when: {}, then: { addTags: ['全打'] } }),
        ]);
        expect(preview.patches.some(p => p.id === 'f1')).toBe(false);
    });

    it('移动数、标签数、标记数分别统计', () => {
        const preview = planOrganize(nodes, [
            rule('a', 1, {
                when: { domainContains: 'github.com' },
                then: { moveToFolderId: 'f1', addTags: ['开发'], setFavorite: true },
            }),
        ]);

        expect(preview.moveCount).toBe(2);
        expect(preview.tagCount).toBe(2);
        expect(preview.flagCount).toBe(2);
    });

    it('补丁条数与明细里的节点数一致', () => {
        const preview = planOrganize(nodes, [
            rule('a', 1, { when: { domainContains: 'github.com' }, then: { addTags: ['开发'] } }),
        ]);

        const detailIds = preview.details.flatMap(d => d.nodeIds).sort();
        const patchIds = preview.patches.map(p => p.id).sort();
        expect(detailIds).toEqual(patchIds);
    });

    it('禁用的规则不参与', () => {
        const preview = planOrganize(nodes, [
            rule('a', 1, { enabled: false, then: { addTags: ['开发'] } }),
        ]);
        expect(preview.affectedCount).toBe(0);
    });

    it('没有条件的规则被忽略（否则会命中全部）', () => {
        const preview = planOrganize(nodes, [rule('a', 1, { when: {}, then: { addTags: ['x'] } })]);
        expect(preview.affectedCount).toBe(0);
    });

    it('没有动作的规则被忽略', () => {
        const preview = planOrganize(nodes, [rule('a', 1, { then: {} })]);
        expect(preview.affectedCount).toBe(0);
    });

    it('无命中时返回全零预览', () => {
        const preview = planOrganize(nodes, [
            rule('a', 1, { when: { domainContains: '不存在的域名' }, then: { addTags: ['x'] } }),
        ]);

        expect(preview.affectedCount).toBe(0);
        expect(preview.details).toEqual([]);
        expect(preview.patches).toEqual([]);
        expect(preview.moves).toEqual([]);
    });

    it('已软删除的书签不参与', () => {
        const withDeleted = {
            gh1: bookmark('gh1', { url: 'https://github.com/a' }),
            gone: bookmark('gone', { url: 'https://github.com/b', deletedAt: 1 }),
        };
        const preview = planOrganize(withDeleted, [
            rule('a', 1, { when: { domainContains: 'github.com' }, then: { addTags: ['开发'] } }),
        ]);
        expect(preview.affectedCount).toBe(1);
    });
});

describe('isValidTargetFolder', () => {
    it('存在且未删除的文件夹合法', () => {
        expect(isValidTargetFolder({ f1: folder('f1') }, 'f1')).toBe(true);
    });

    it('书签不能作为目标', () => {
        expect(isValidTargetFolder({ b1: bookmark('b1') }, 'b1')).toBe(false);
    });

    it('已删除的文件夹不合法', () => {
        expect(isValidTargetFolder({ f1: folder('f1', { deletedAt: 1 }) }, 'f1')).toBe(false);
    });

    it('不存在的 id 不合法', () => {
        expect(isValidTargetFolder({}, 'nope')).toBe(false);
    });
});
