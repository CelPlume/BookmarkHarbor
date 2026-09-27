/**
 * 多字段加权检索（纯逻辑，不依赖框架）
 *
 * 书签标题大量是中文，用户却常常按拼音或首字母去记——
 * 只做 `includes` 原文匹配会漏掉「前端开发」这类条目。
 *
 * 匹配优先级（数字越小排越前）：
 *   0 标题原文  1 标签  2 标题拼音全拼  3 标题首字母  4 网址  5 备注
 */

import { pinyin } from 'pinyin-pro';
import type { Node } from './types';

export type MatchField = 'title' | 'tag' | 'pinyin' | 'initial' | 'url' | 'notes';

const FIELD_WEIGHT: Record<MatchField, number> = {
    title: 0,
    tag: 1,
    pinyin: 2,
    initial: 3,
    url: 4,
    notes: 5,
};

export interface ParsedQuery {
    /** 自由关键字（空格分隔，取交集） */
    terms: string[];
    /** tag:xxx 条件，取交集 */
    tags: string[];
    /** site:xxx 条件，取交集（匹配域名） */
    sites: string[];
    /** is:fav */
    favorite: boolean;
    /** is:later */
    readLater: boolean;
}

/**
 * 解析查询语法
 *
 * 支持 `tag:前端 site:github.com is:fav is:later 关键字`。
 * 无法识别的片段按普通关键字处理，不做报错——搜索框不该因为
 * 用户敲了个冒号就罢工。
 */
export function parseQuery(input: string): ParsedQuery {
    const result: ParsedQuery = {
        terms: [],
        tags: [],
        sites: [],
        favorite: false,
        readLater: false,
    };

    const tokens = input.trim().split(/\s+/).filter(Boolean);

    tokens.forEach(token => {
        const lower = token.toLowerCase();

        if (lower.startsWith('tag:') && token.length > 4) {
            result.tags.push(token.slice(4).toLowerCase());
            return;
        }
        if (lower.startsWith('site:') && token.length > 5) {
            result.sites.push(token.slice(5).toLowerCase());
            return;
        }
        if (lower === 'is:fav' || lower === 'is:favorite') {
            result.favorite = true;
            return;
        }
        if (lower === 'is:later' || lower === 'is:readlater') {
            result.readLater = true;
            return;
        }

        result.terms.push(lower);
    });

    return result;
}

/** 查询是否为空（没有任何条件） */
export function isQueryEmpty(query: ParsedQuery): boolean {
    return query.terms.length === 0
        && query.tags.length === 0
        && query.sites.length === 0
        && !query.favorite
        && !query.readLater;
}

/** 标题的拼音索引：全拼与首字母 */
export interface PinyinIndex {
    full: string;
    initials: string;
}

/**
 * 为一组标题预计算拼音索引
 *
 * 拼音转换不便宜，所以按标题缓存——同一个标题只算一次，
 * 列表重渲染时不会重复计算。
 */
const pinyinCache = new Map<string, PinyinIndex>();

export function getPinyinIndex(title: string): PinyinIndex {
    const cached = pinyinCache.get(title);
    if (cached) return cached;

    let index: PinyinIndex;
    try {
        const full = pinyin(title, { toneType: 'none', type: 'array' }).join('');
        const initials = pinyin(title, { pattern: 'first', toneType: 'none', type: 'array' }).join('');
        index = {
            full: full.toLowerCase().replace(/\s+/g, ''),
            initials: initials.toLowerCase().replace(/\s+/g, ''),
        };
    } catch {
        index = { full: '', initials: '' };
    }

    pinyinCache.set(title, index);
    return index;
}

/** 清空拼音缓存（标题大批量变更时可调用） */
export function clearPinyinCache(): void {
    pinyinCache.clear();
}

export interface ScoredMatch {
    node: Node;
    /** 命中的最优字段权重，越小越相关 */
    weight: number;
    field: MatchField;
}

/** 从网址中取域名 */
function domainOf(url: string | undefined): string {
    if (!url) return '';
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return '';
    }
}

/**
 * 在单个节点上求最优命中
 *
 * 返回 null 表示该节点不满足任一关键字条件。
 * 标签 / 站点 / 收藏 / 稍后阅读属于过滤条件（布尔），
 * 关键字属于打分条件（决定排序）。
 */
export function matchNode(node: Node, query: ParsedQuery): ScoredMatch | null {
    if (node.deletedAt) return null;

    // 布尔过滤条件：不满足直接淘汰
    if (query.favorite && !node.isFavorite) return null;
    if (query.readLater && !node.isReadLater) return null;

    if (query.tags.length > 0) {
        const nodeTags = (node.tags ?? []).map(tag => tag.toLowerCase());
        if (!query.tags.every(tag => nodeTags.includes(tag))) return null;
    }

    if (query.sites.length > 0) {
        const domain = domainOf(node.url);
        if (!domain) return null;
        if (!query.sites.every(site => domain.includes(site))) return null;
    }

    if (query.terms.length === 0) {
        // 只有过滤条件，没有关键字：视为命中，权重最低
        return { node, weight: FIELD_WEIGHT.title, field: 'title' };
    }

    const title = node.title.toLowerCase();
    const url = (node.url ?? '').toLowerCase();
    const notes = (node.notes ?? '').toLowerCase();
    const tags = (node.tags ?? []).map(tag => tag.toLowerCase());

    const { full, initials } = getPinyinIndex(node.title);

    let best: ScoredMatch | null = null;

    const consider = (field: MatchField) => {
        const weight = FIELD_WEIGHT[field];
        if (!best || weight < best.weight) {
            best = { node, weight, field };
        }
    };

    // 每个关键字都必须命中至少一个字段（取交集），
    // 但打分取所有关键字中最优的那个字段
    for (const term of query.terms) {
        let hit = false;

        if (title.includes(term)) { consider('title'); hit = true; }
        if (tags.some(tag => tag.includes(term))) { consider('tag'); hit = true; }
        if (full && full.includes(term)) { consider('pinyin'); hit = true; }
        if (initials && initials.includes(term)) { consider('initial'); hit = true; }
        if (url.includes(term)) { consider('url'); hit = true; }
        if (notes.includes(term)) { consider('notes'); hit = true; }

        if (!hit) return null;
    }

    return best;
}

/**
 * 批量检索并排序
 *
 * 先按命中权重升序（更相关的在前），权重相同按 orderKey 保持原有顺序。
 */
export function searchNodes(nodes: Node[], query: ParsedQuery): Node[] {
    if (isQueryEmpty(query)) return nodes;

    const matches: ScoredMatch[] = [];
    nodes.forEach(node => {
        const match = matchNode(node, query);
        if (match) matches.push(match);
    });

    return matches
        .sort((a, b) =>
            a.weight - b.weight || a.node.orderKey.localeCompare(b.node.orderKey)
        )
        .map(match => match.node);
}
