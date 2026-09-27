/**
 * 规则化自动整理（纯逻辑，不依赖框架）
 *
 * 导入几百上千条书签后逐条手工归类不现实。规则把"看到什么就放到哪"
 * 写成可复用、可预览、可撤销的声明，导入完成后一键套用。
 *
 * 设计取向：
 * - **先预览后执行**：plan 只算不改，用户确认后才落库
 * - **可整体撤销**：一批整理只产生一条历史记录
 * - **正则可控**：用户写的正则先试编译并限长，避免灾难性回溯卡死页面
 */

import type {
    AutoOrganizeRule,
    Node,
    RuleCondition,
    RuleAction,
    OrganizePreview,
    RuleMatchDetail,
    UpdateNodeRequest,
} from './types';

/** 用户输入正则的长度上限，防止超长表达式拖慢匹配 */
export const MAX_REGEX_LENGTH = 200;

/**
 * 校验用户输入的正则
 *
 * 返回 null 表示合法，否则返回错误说明。
 * 用 try 编译而不是 try 匹配——大部分非法正则在编译期就会抛错，
 * 也顺带拦住 "(" 这种只在编译时暴露问题的写法。
 */
export function validateRegex(pattern: string): string | null {
    if (!pattern) return null;
    if (pattern.length > MAX_REGEX_LENGTH) {
        return `正则过长（上限 ${MAX_REGEX_LENGTH} 字符）`;
    }
    try {
        new RegExp(pattern);
        return null;
    } catch (error) {
        return error instanceof Error ? error.message : '正则表达式无效';
    }
}

/** 校验整条规则的正则字段 */
export function validateRuleRegexes(rule: Pick<AutoOrganizeRule, 'when'>): string[] {
    const problems: string[] = [];
    const titleError = validateRegex(rule.when.titleRegex ?? '');
    if (titleError) problems.push(`标题正则：${titleError}`);
    const urlError = validateRegex(rule.when.urlRegex ?? '');
    if (urlError) problems.push(`网址正则：${urlError}`);
    return problems;
}

/** 从网址里取主机名，取不到返回空串 */
function domainOf(url: string | undefined): string {
    if (!url) return '';
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return '';
    }
}

/**
 * 判断单个节点是否满足规则的全部条件
 *
 * 未填写的条件不参与判断（相当于"不限制"）；填写的条件之间是「与」关系。
 */
export function matchesCondition(node: Node, when: RuleCondition): boolean {
    if (node.deletedAt) return false;

    // 域名只对书签有意义
    if (when.domainContains) {
        const domain = domainOf(node.url);
        if (!domain || !domain.includes(when.domainContains.toLowerCase())) {
            return false;
        }
    }

    if (when.titleRegex) {
        // 正则已在 validateRegex 里试编译过，这里仍包一层防御
        try {
            if (!new RegExp(when.titleRegex).test(node.title)) return false;
        } catch {
            return false;
        }
    }

    if (when.urlRegex) {
        if (!node.url) return false;
        try {
            if (!new RegExp(when.urlRegex).test(node.url)) return false;
        } catch {
            return false;
        }
    }

    if (typeof when.createdBefore === 'number' && node.createdAt >= when.createdBefore) {
        return false;
    }
    if (typeof when.createdAfter === 'number' && node.createdAt <= when.createdAfter) {
        return false;
    }

    if (when.tagIn && when.tagIn.length > 0) {
        const nodeTags = node.tags ?? [];
        if (!when.tagIn.some(tag => nodeTags.includes(tag))) return false;
    }

    return true;
}

/** 规则是否至少配置了一个条件（没有条件的规则会命中全部书签） */
export function hasAnyCondition(when: RuleCondition): boolean {
    return Boolean(
        when.domainContains
        || when.titleRegex
        || when.urlRegex
        || typeof when.createdBefore === 'number'
        || typeof when.createdAfter === 'number'
        || (when.tagIn && when.tagIn.length > 0)
    );
}

/** 规则是否至少配置了一个动作（没有动作的规则什么也不做） */
export function hasAnyAction(then: RuleAction): boolean {
    return Boolean(
        then.moveToFolderId
        || (then.addTags && then.addTags.length > 0)
        || then.setFavorite
        || then.setReadLater
    );
}

/**
 * 把一条规则的动作合并到某节点已有的待写入补丁上
 *
 * 多条规则命中同一节点时，补丁要叠加而不是互相覆盖：
 * 标签取并集，收藏/稍后阅读标记取或。
 * 移动单独用 Map 记录，以后命中的规则为准——排在后面的规则是用户后补的，
 * 通常更"具体"，让它覆盖前面的宽泛分类更符合预期。
 */
function mergeAction(
    existing: UpdateNodeRequest | undefined,
    node: Node,
    action: RuleAction
): UpdateNodeRequest {
    const patch: UpdateNodeRequest = { ...(existing ?? {}) };

    if (action.addTags && action.addTags.length > 0) {
        const current = patch.tags ?? node.tags ?? [];
        const merged = new Set(current);
        action.addTags.forEach(tag => merged.add(tag));
        patch.tags = Array.from(merged);
    }

    if (action.setFavorite) patch.isFavorite = true;
    if (action.setReadLater) patch.isReadLater = true;

    return patch;
}

/**
 * 计算一次整理会做什么，但不改动任何数据
 *
 * 规则按 priority 升序依次匹配，避免重复处理同一节点。
 * 返回的 patches / moves 是执行时的输入，执行方负责落库与记历史。
 */
export function planOrganize(
    nodes: Record<string, Node>,
    rules: AutoOrganizeRule[]
): OrganizePreview {
    const enabled = [...rules]
        .filter(rule => rule.enabled)
        .filter(rule => hasAnyCondition(rule.when) && hasAnyAction(rule.then))
        .sort((a, b) => a.priority - b.priority);

    const patches = new Map<string, UpdateNodeRequest>();
    const moves = new Map<string, string>();
    const details: RuleMatchDetail[] = [];

    // 只在书签上做整理；文件夹不参与——移动文件夹会牵连整棵子树，
    // 意图不明确且撤销代价高
    const bookmarks = Object.values(nodes).filter(
        node => !node.deletedAt && node.type === 'bookmark'
    );

    enabled.forEach(rule => {
        const matchedIds: string[] = [];

        bookmarks.forEach(node => {
            if (!matchesCondition(node, rule.when)) return;

            // 已被更早的规则处理过，且本规则要求停止匹配时跳过
            if (patches.has(node.id) && !rule.continueMatching) return;

            matchedIds.push(node.id);
            patches.set(node.id, mergeAction(patches.get(node.id), node, rule.then));

            if (rule.then.moveToFolderId) {
                moves.set(node.id, rule.then.moveToFolderId);
            }
        });

        if (matchedIds.length > 0) {
            details.push({
                ruleId: rule.id,
                ruleName: rule.name,
                nodeIds: matchedIds,
            });
        }
    });

    // 统计各动作数量
    let tagCount = 0;
    let flagCount = 0;

    patches.forEach((patch, id) => {
        const node = nodes[id];
        const beforeTags = node?.tags?.length ?? 0;
        if (patch.tags && patch.tags.length > beforeTags) tagCount += 1;
        if (patch.isFavorite || patch.isReadLater) flagCount += 1;
    });

    // 待修改集合 = 有字段更新的 + 有移动的
    const affectedIds = new Set<string>([...patches.keys(), ...moves.keys()]);

    return {
        affectedCount: affectedIds.size,
        moveCount: moves.size,
        tagCount,
        flagCount,
        details,
        patches: Array.from(patches.entries())
            .filter(([, patch]) => Object.keys(patch).length > 0)
            .map(([id, patch]) => ({ id, patch })),
        moves: Array.from(moves.entries()).map(([id, toFolderId]) => ({ id, toFolderId })),
    };
}

/**
 * 检查目标文件夹是否合法：必须存在、是未删除的文件夹、且不是书签自身
 */
export function isValidTargetFolder(nodes: Record<string, Node>, folderId: string): boolean {
    const folder = nodes[folderId];
    return Boolean(folder && folder.type === 'folder' && !folder.deletedAt);
}
