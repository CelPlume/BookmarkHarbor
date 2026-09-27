/**
 * 规则模板（纯逻辑，不依赖框架）
 *
 * 空白规则编辑器没人愿意从零写正则。模板给出一批常见的
 * 「把哪类站点归到哪」的起点，用户导入后一键展开再按需调整。
 *
 * 这组分类参考自真实用户导出的书签库：一位重度用户手工建了
 * 82 个文件夹做分类，其中反复出现的就是下面这些类别。
 */

import type { AutoOrganizeRule, RuleCondition, RuleAction } from './types';
import { hasAnyCondition, hasAnyAction } from './rules';

/** 模板里的单条规则：不含 id / 优先级等运行时字段 */
export interface RuleTemplate {
    /** 模板标识，作为规则名的 i18n key */
    key: string;
    when: RuleCondition;
    then: RuleAction;
}

export interface RuleTemplateGroup {
    /** 分组标识，用于 i18n */
    key: string;
    rules: RuleTemplate[];
}

/**
 * 内置模板分组
 *
 * 只放各领域识别度最高的站点，宁可少而准：
 * 一条错误归类比没有归类更让人恼火。
 */
export const RULE_TEMPLATE_GROUPS: RuleTemplateGroup[] = [
    {
        key: 'dev',
        rules: [
            { key: 'github', when: { domainContains: 'github.com' }, then: { addTags: ['开发', '代码托管'] } },
            { key: 'gitee', when: { domainContains: 'gitee.com' }, then: { addTags: ['开发', '代码托管'] } },
            { key: 'stackoverflow', when: { domainContains: 'stackoverflow.com' }, then: { addTags: ['开发', '问答'] } },
            { key: 'npm', when: { domainContains: 'npmjs.com' }, then: { addTags: ['开发', '前端'] } },
            { key: 'mdn', when: { domainContains: 'developer.mozilla.org' }, then: { addTags: ['开发', '文档'] } },
            { key: 'juejin', when: { domainContains: 'juejin.cn' }, then: { addTags: ['开发', '中文社区'] } },
            { key: 'csdn', when: { domainContains: 'csdn.net' }, then: { addTags: ['开发', '中文社区'] } },
        ],
    },
    {
        key: 'design',
        rules: [
            { key: 'figma', when: { domainContains: 'figma.com' }, then: { addTags: ['设计', '工具'] } },
            { key: 'dribbble', when: { domainContains: 'dribbble.com' }, then: { addTags: ['设计', '灵感'] } },
            { key: 'behance', when: { domainContains: 'behance.net' }, then: { addTags: ['设计', '灵感'] } },
            { key: 'unsplash', when: { domainContains: 'unsplash.com' }, then: { addTags: ['设计', '素材'] } },
            { key: 'iconfont', when: { domainContains: 'iconfont.cn' }, then: { addTags: ['设计', '图标'] } },
            { key: 'zcool', when: { domainContains: 'zcool.com.cn' }, then: { addTags: ['设计', '中文社区'] } },
        ],
    },
    {
        key: 'media',
        rules: [
            { key: 'bilibili', when: { domainContains: 'bilibili.com' }, then: { addTags: ['视频'] } },
            { key: 'youtube', when: { domainContains: 'youtube.com' }, then: { addTags: ['视频'] } },
            { key: 'neteaseMusic', when: { domainContains: 'music.163.com' }, then: { addTags: ['音乐'] } },
            { key: 'spotify', when: { domainContains: 'spotify.com' }, then: { addTags: ['音乐'] } },
            { key: 'douban', when: { domainContains: 'douban.com' }, then: { addTags: ['影音', '书评'] } },
        ],
    },
    {
        key: 'reading',
        rules: [
            { key: 'zhihu', when: { domainContains: 'zhihu.com' }, then: { addTags: ['资讯', '问答'] } },
            { key: 'jianshu', when: { domainContains: 'jianshu.com' }, then: { addTags: ['阅读'] } },
            { key: 'medium', when: { domainContains: 'medium.com' }, then: { addTags: ['阅读'] } },
            { key: 'wikipedia', when: { domainContains: 'wikipedia.org' }, then: { addTags: ['百科'] } },
            { key: 'arxiv', when: { domainContains: 'arxiv.org' }, then: { addTags: ['论文', '学术'] } },
        ],
    },
    {
        key: 'tools',
        rules: [
            { key: 'notion', when: { domainContains: 'notion.so' }, then: { addTags: ['工具', '笔记'] } },
            { key: 'feishu', when: { domainContains: 'feishu.cn' }, then: { addTags: ['工具', '协作'] } },
            { key: 'docs', when: { domainContains: 'docs.google.com' }, then: { addTags: ['工具', '文档'] } },
            { key: 'translate', when: { domainContains: 'translate.google' }, then: { addTags: ['工具', '翻译'] } },
        ],
    },
];

/**
 * 把模板分组展开成可落库的规则
 *
 * priority 先全部给 0，交给存储层追加时统一编号，
 * 避免模板内部编号与既有规则冲突。
 */
export function instantiateTemplate(
    group: RuleTemplateGroup,
    groupLabel: string,
    ruleLabelOf: (key: string) => string
): Array<Omit<AutoOrganizeRule, 'priority' | 'createdAt' | 'updatedAt'>> {
    return group.rules.map(rule => ({
        id: `${group.key}-${rule.key}-${Math.random().toString(36).slice(2, 10)}`,
        name: `${groupLabel} · ${ruleLabelOf(rule.key)}`,
        enabled: true,
        when: { ...rule.when },
        then: {
            ...rule.then,
            addTags: rule.then.addTags ? [...rule.then.addTags] : undefined,
        },
    }));
}

/**
 * 检查模板展开后是否有可用规则
 *
 * 模板是硬编码的，但仍是数据——写错一个空条件会让规则命中全部书签，
 * 这里挡一道，避免"全部打上同一个标签"这种事故。
 */
export function isUsableTemplate(group: RuleTemplateGroup): boolean {
    return group.rules.length > 0
        && group.rules.every(rule => hasAnyCondition(rule.when) && hasAnyAction(rule.then));
}
