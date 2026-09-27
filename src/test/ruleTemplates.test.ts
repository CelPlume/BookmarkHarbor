/**
 * 规则模板测试
 */

import { describe, it, expect } from 'vitest';
import {
    RULE_TEMPLATE_GROUPS,
    instantiateTemplate,
    isUsableTemplate,
} from '../core/ruleTemplates';

describe('内置模板分组', () => {
    it('每个分组都有规则', () => {
        RULE_TEMPLATE_GROUPS.forEach(group => {
            expect(group.rules.length).toBeGreaterThan(0);
        });
    });

    it('分组 key 不重复', () => {
        const keys = RULE_TEMPLATE_GROUPS.map(g => g.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('所有模板都可用（有条件、有动作）', () => {
        RULE_TEMPLATE_GROUPS.forEach(group => {
            expect(isUsableTemplate(group)).toBe(true);
        });
    });

    it('同一分组内规则 key 不重复', () => {
        RULE_TEMPLATE_GROUPS.forEach(group => {
            const keys = group.rules.map(r => r.key);
            expect(new Set(keys).size).toBe(keys.length);
        });
    });
});

describe('instantiateTemplate', () => {
    const group = RULE_TEMPLATE_GROUPS[0];

    it('展开出与模板数量一致的规则', () => {
        const rules = instantiateTemplate(group, '开发', k => k);
        expect(rules).toHaveLength(group.rules.length);
    });

    it('每条规则都有唯一 id', () => {
        const rules = instantiateTemplate(group, '开发', k => k);
        const ids = rules.map(r => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('默认启用', () => {
        const rules = instantiateTemplate(group, '开发', k => k);
        expect(rules.every(r => r.enabled)).toBe(true);
    });

    it('规则名由分组标签与规则标签拼成', () => {
        const rules = instantiateTemplate(group, '开发', k => `标签-${k}`);
        expect(rules[0].name).toBe(`开发 · 标签-${group.rules[0].key}`);
    });

    it('不生成 priority（交给存储层编号）', () => {
        const rules = instantiateTemplate(group, '开发', k => k);
        rules.forEach(rule => {
            expect(rule).not.toHaveProperty('priority');
            expect(rule).not.toHaveProperty('createdAt');
        });
    });

    it('标签数组是副本，改一条不影响模板本身', () => {
        const before = JSON.stringify(group.rules[0].then);
        const rules = instantiateTemplate(group, '开发', k => k);

        rules[0].then.addTags?.push('被篡改');

        expect(JSON.stringify(group.rules[0].then)).toBe(before);
    });
});

describe('isUsableTemplate', () => {
    it('空分组不可用', () => {
        expect(isUsableTemplate({ key: 'x', rules: [] })).toBe(false);
    });

    it('含无动作规则的分组不可用', () => {
        expect(isUsableTemplate({
            key: 'x',
            rules: [{ key: 'bad', when: { domainContains: 'a.com' }, then: {} }],
        })).toBe(false);
    });

    it('含无条件规则的分组不可用（会命中全部书签）', () => {
        expect(isUsableTemplate({
            key: 'x',
            rules: [{ key: 'bad', when: {}, then: { addTags: ['全部'] } }],
        })).toBe(false);
    });
});
