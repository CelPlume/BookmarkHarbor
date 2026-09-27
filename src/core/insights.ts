/**
 * 书签体检（纯逻辑，不依赖框架）
 *
 * 浏览器书签只记录"存了什么"，从不记录"用了什么"。于是每个人都在攒
 * 一个自己都不了解的书签库：几千条里真正在用的可能只有几十条。
 *
 * 这组函数把使用记录变成可回答的问题：哪些是僵尸、哪些是主力、
 * 哪些很久没碰过。数据全部来自本软件内部，不联网、不外传。
 */

import type { Node } from './types';

/** 多久没打开算"久未使用"，默认 180 天 */
export const STALE_DAYS = 180;

/** 一天毫秒数 */
const DAY_MS = 24 * 60 * 60 * 1000;

export interface LibraryReport {
    /** 书签总数（不含文件夹、不含回收站） */
    total: number;
    /** 从未打开过的 */
    neverUsed: Node[];
    /** 打开过的 */
    used: Node[];
    /** 超过 STALE_DAYS 未打开的（含从未打开且创建已久的） */
    stale: Node[];
    /** 打开次数排名前 N 的 */
    top: Node[];
    /**
     * 活跃占比（0-1）
     *
     * 从未打开的直接算不活跃。库很小时这个数字不稳定，
     * 界面应同时给出绝对条数。
     */
    activeRatio: number;
}

/** 取出库里的书签：未删除、非文件夹、有 url */
export function listBookmarks(nodes: Record<string, Node>): Node[] {
    return Object.values(nodes).filter(
        node => !node.deletedAt && node.type === 'bookmark' && Boolean(node.url)
    );
}

/**
 * 判断是否"久未使用"
 *
 * 从未打开过的：以创建时间为准——刚加进来三天的书签不该被叫僵尸。
 * 打开过的：以最后打开时间为准。
 * 两者都超过阈值才算。
 */
export function isStale(node: Node, now: number, staleDays: number = STALE_DAYS): boolean {
    const reference = node.lastUsedAt ?? node.createdAt;
    if (!reference) return false;
    return now - reference > staleDays * DAY_MS;
}

/**
 * 生成书签库体检报告
 *
 * @param now 当前时间，由调用方传入，便于测试
 */
export function buildLibraryReport(
    nodes: Record<string, Node>,
    now: number,
    options: { topCount?: number; staleDays?: number } = {}
): LibraryReport {
    const topCount = options.topCount ?? 20;
    const staleDays = options.staleDays ?? STALE_DAYS;

    const bookmarks = listBookmarks(nodes);

    const neverUsed = bookmarks.filter(node => !node.useCount);
    const used = bookmarks.filter(node => (node.useCount ?? 0) > 0);
    const stale = bookmarks.filter(node => isStale(node, now, staleDays));

    // 打开次数降序；次数相同时最近打开的在前，再相同按 orderKey 保持稳定
    const top = [...used]
        .sort((a, b) =>
            (b.useCount ?? 0) - (a.useCount ?? 0)
            || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
            || a.orderKey.localeCompare(b.orderKey)
        )
        .slice(0, topCount);

    return {
        total: bookmarks.length,
        neverUsed,
        used,
        stale,
        top,
        activeRatio: bookmarks.length > 0 ? used.length / bookmarks.length : 0,
    };
}

/** 把时间戳格式化为"几天前 / 几个月前"，用于体检界面的可读性 */
export function describeLastUse(node: Node, now: number): string {
    if (!node.lastUsedAt) {
        return node.useCount ? 'USED_UNKNOWN' : 'NEVER_USED';
    }

    const days = Math.floor((now - node.lastUsedAt) / DAY_MS);
    if (days <= 0) return 'TODAY';
    if (days === 1) return 'YESTERDAY';
    if (days < 30) return `${days}D`;
    if (days < 365) return `${Math.floor(days / 30)}M`;
    return `${Math.floor(days / 365)}Y`;
}

/**
 * 按固定到书签栏的标记取出节点
 *
 * 书签栏是一处「引用」而不是副本：节点仍留在原文件夹，
 * 只是额外在书签栏出现一次。这与浏览器自带书签栏的复制语义不同，
 * 也是文件管理器里"快捷方式"的思路。
 */
export function listPinned(nodes: Record<string, Node>): Node[] {
    return listBookmarks(nodes)
        .filter(node => node.isPinned)
        .sort((a, b) => a.orderKey.localeCompare(b.orderKey));
}
