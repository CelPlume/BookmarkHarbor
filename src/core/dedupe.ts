/**
 * 重复书签检测与合并（纯逻辑，不依赖框架）
 *
 * 判定"重复"的关键是 URL 规范化：同一个页面常有多条不同写法
 * （http/https、带不带 www.、带不带跟踪参数、参数顺序不同），
 * 直接字符串比较会漏判。
 */

import type { Node } from './types';

/**
 * 跟踪参数名单：这些参数只用于来源归因，不影响页面内容，
 * 比较前统一剥离。集中维护便于扩展。
 */
export const TRACKING_PARAMS: readonly string[] = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'fbclid',
    'gclid',
    'dclid',
    'msclkid',
    'spm',
    'scm',
    'from',
    'ref',
    'referrer',
    'source',
    'share_source',
    '_ga',
    '_gl',
];

/**
 * 规范化 URL，用于判断两个书签是否指向同一页面
 *
 * 处理规则：
 * - scheme 与 host 统一小写；http 与 https 视为同一
 * - 去掉 www. 前缀
 * - 去掉默认端口 80 / 443
 * - 去掉路径末尾的 `/`（根路径 `/` 保留）
 * - 剥离跟踪参数，其余查询参数按键名排序后保留
 * - 剥离 `#fragment`，但保留 `#/` 与 `#!` 开头的哈希路由
 *   （单页应用靠它区分页面，剥掉会把不同页面误判为重复）
 *
 * 无法解析时返回 null，调用方应跳过该节点。
 */
export function normalizeUrl(raw: string): string | null {
    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        return null;
    }

    // 只处理 http/https，其余协议（javascript:、data: 等）不参与去重
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);

    let port = url.port;
    if (port === '80' || port === '443') port = '';

    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.replace(/\/+$/, '');
    }

    const params = Array.from(url.searchParams.entries())
        .filter(([key]) => !TRACKING_PARAMS.includes(key.toLowerCase()))
        .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const query = params.length > 0
        ? '?' + params.map(([key, value]) => `${key}=${value}`).join('&')
        : '';

    const hash = url.hash.startsWith('#/') || url.hash.startsWith('#!') ? url.hash : '';

    return `https://${host}${port ? ':' + port : ''}${pathname}${query}${hash}`;
}

export interface DuplicateGroup {
    /** 规范化后的 URL，作为分组标识 */
    key: string;
    /** 该组内的书签，按 orderKey 排序 */
    nodes: Node[];
}

/**
 * 查找重复书签分组
 *
 * 只扫描未删除的书签节点；组内节点数 ≥ 2 才视为重复。
 * 结果按"每组节省的条数"降序、其次按 key 排序，保证顺序稳定。
 */
export function findDuplicateGroups(nodes: Record<string, Node>): DuplicateGroup[] {
    const buckets = new Map<string, Node[]>();

    Object.values(nodes).forEach(node => {
        if (node.deletedAt || node.type !== 'bookmark' || !node.url) return;
        const key = normalizeUrl(node.url);
        if (!key) return;
        const bucket = buckets.get(key);
        if (bucket) {
            bucket.push(node);
        } else {
            buckets.set(key, [node]);
        }
    });

    return Array.from(buckets.entries())
        .filter(([, group]) => group.length > 1)
        .map(([key, group]) => ({
            key,
            nodes: [...group].sort((a, b) => a.orderKey.localeCompare(b.orderKey)),
        }))
        .sort((a, b) => b.nodes.length - a.nodes.length || a.key.localeCompare(b.key));
}

export type MergeStrategy = 'oldest' | 'newest' | 'richest';

/**
 * 信息完整度评分：封面、图标、备注各计 1 分，标签按数量计分。
 * 用于 'richest' 策略挑出"信息最多的那条"作为保留项。
 */
function richnessScore(node: Node): number {
    let score = 0;
    if (node.coverUrl) score += 1;
    if (node.iconUrl) score += 1;
    if (node.notes && node.notes.trim()) score += 1;
    score += node.tags?.length ?? 0;
    return score;
}

export interface MergePlan {
    /** 保留的节点 id */
    keepId: string;
    /** 拟删除的节点 id（软删除进回收站） */
    removeIds: string[];
    /** 合并后要写回保留节点的字段 */
    merged: Partial<Node>;
}

/**
 * 为一个重复组生成合并方案
 *
 * 保留项按策略选出，其余节点软删除。被删节点的标签取并集、
 * 备注非空去重拼接、收藏与稍后阅读标记取或，避免合并丢信息。
 */
export function planMerge(group: Node[], strategy: MergeStrategy = 'oldest'): MergePlan | null {
    if (group.length < 2) return null;

    const pick = (): Node => {
        const sorted = [...group];
        switch (strategy) {
            case 'newest':
                sorted.sort((a, b) =>
                    (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt) ||
                    a.orderKey.localeCompare(b.orderKey)
                );
                break;
            case 'richest':
                sorted.sort((a, b) =>
                    richnessScore(b) - richnessScore(a) ||
                    (a.createdAt ?? 0) - (b.createdAt ?? 0) ||
                    a.orderKey.localeCompare(b.orderKey)
                );
                break;
            case 'oldest':
            default:
                sorted.sort((a, b) =>
                    (a.createdAt ?? 0) - (b.createdAt ?? 0) ||
                    a.orderKey.localeCompare(b.orderKey)
                );
                break;
        }
        return sorted[0];
    };

    const keep = pick();
    const removed = group.filter(node => node.id !== keep.id);

    // 标签并集，保持保留项原有顺序在前
    const tagSet = new Set(keep.tags ?? []);
    removed.forEach(node => node.tags?.forEach(tag => tagSet.add(tag)));

    // 备注：非空去重后拼接，保留项备注在前
    const noteParts: string[] = [];
    [keep, ...removed].forEach(node => {
        const text = node.notes?.trim();
        if (text && !noteParts.includes(text)) noteParts.push(text);
    });

    const merged: Partial<Node> = {};

    const tags = Array.from(tagSet);
    if (tags.length > 0) merged.tags = tags;

    if (noteParts.length > 0) {
        merged.notes = noteParts.join('\n\n');
    } else if (keep.notes) {
        merged.notes = keep.notes;
    }

    // 标记取或：任一条被收藏/标记稍后阅读，合并后都保留
    if (group.some(node => node.isFavorite)) merged.isFavorite = true;
    if (group.some(node => node.isReadLater)) merged.isReadLater = true;

    // 保留项缺少封面或图标时，从同组其它条目补齐
    if (!keep.coverUrl) {
        const donor = removed.find(node => node.coverUrl);
        if (donor) {
            merged.coverUrl = donor.coverUrl;
            merged.coverType = donor.coverType;
        }
    }
    if (!keep.iconUrl) {
        const donor = removed.find(node => node.iconUrl);
        if (donor) {
            merged.iconUrl = donor.iconUrl;
            merged.iconSource = donor.iconSource;
        }
    }

    return {
        keepId: keep.id,
        removeIds: removed.map(node => node.id),
        merged,
    };
}

/**
 * 批量为所有重复组生成合并方案
 */
export function planMergeAll(
    groups: DuplicateGroup[],
    strategy: MergeStrategy = 'oldest'
): MergePlan[] {
    return groups
        .map(group => planMerge(group.nodes, strategy))
        .filter((plan): plan is MergePlan => plan !== null);
}
