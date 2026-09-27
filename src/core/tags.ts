/**
 * 标签索引与筛选（纯逻辑，不依赖框架）
 *
 * 标签是文件夹层级之外的第二条分类轴：文件夹决定书签"放在哪"，
 * 标签描述书签"是什么"，可以跨越目录边界。
 */

import type { Node } from './types';

/**
 * 统计全部在用标签及其书签数量
 *
 * 只统计未删除的书签节点；文件夹不参与标签索引。
 * 排序规则：数量降序，同数量按名称升序，保证列表稳定可预期。
 */
export function collectTagCounts(nodes: Record<string, Node>): Array<[string, number]> {
    const counts = new Map<string, number>();

    Object.values(nodes).forEach(node => {
        if (node.deletedAt || node.type !== 'bookmark' || !node.tags) return;
        node.tags.forEach(tag => {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
        });
    });

    return Array.from(counts.entries()).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    );
}

/**
 * 按标签筛选书签，多标签取交集（AND）
 *
 * 传入空标签列表时返回空数组而非全集——调用方应据此跳过筛选，
 * 避免"没有筛选条件"被误当成"筛选结果为空"。
 */
export function filterByTags(nodes: Record<string, Node>, activeTags: string[]): Node[] {
    if (activeTags.length === 0) return [];

    return Object.values(nodes)
        .filter(n => !n.deletedAt && n.id !== 'root' && n.type === 'bookmark')
        .filter(n => activeTags.every(tag => n.tags?.includes(tag)))
        .sort((a, b) => a.orderKey.localeCompare(b.orderKey));
}

/**
 * 归一化标签输入：去首尾空白，空串返回 null
 */
export function normalizeTag(input: string): string | null {
    const value = input.trim();
    return value.length > 0 ? value : null;
}

/**
 * 向标签列表追加标签，已存在则原样返回（去重、保持录入顺序）
 */
export function appendTag(tags: string[] | undefined, tag: string): string[] {
    const current = tags ?? [];
    return current.includes(tag) ? current : [...current, tag];
}

/**
 * 从标签列表移除标签，移除后为空则返回 undefined（便于清除存储字段）
 */
export function removeTag(tags: string[] | undefined, tag: string): string[] | undefined {
    const next = (tags ?? []).filter(t => t !== tag);
    return next.length > 0 ? next : undefined;
}
