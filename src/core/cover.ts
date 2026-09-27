/**
 * 确定性封面生成（纯逻辑，不依赖框架）
 *
 * 没有 og:image 的书签在卡片视图里是空封面。与其每次向第三方抓图，
 * 不如由域名确定性地生成一张：同一个网站永远得到同一种配色，
 * 零网络请求，也不需要把图片存进 LocalStorage。
 */

import type { Node } from './types';
import { normalizeUrl } from './dedupe';

/**
 * FNV-1a 32 位哈希
 *
 * 选它是因为同步、无依赖、分布均匀：封面要在渲染时同步算出，
 * crypto.subtle 是异步的，用不了。
 */
export function fnv1a(input: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        // hash *= 16777619，用移位避免超出 32 位精度
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

/**
 * 取书签的域名作为配色种子
 *
 * 复用 normalizeUrl，使 http/https、带不带 www. 的同一站点得到同一种颜色。
 */
export function colorSeedFor(url: string | undefined, fallback: string): string {
    if (url) {
        const normalized = normalizeUrl(url);
        if (normalized) {
            try {
                return new URL(normalized).hostname;
            } catch {
                // 落到 fallback
            }
        }
    }
    return fallback;
}

/** 由种子推导基色相（0-359） */
export function hueFor(seed: string): number {
    return fnv1a(seed) % 360;
}

export interface CoverColors {
    from: string;
    to: string;
    hue: number;
}

/**
 * 由种子生成双色渐变：基色相 h 与其 +40° 邻近色，
 * 两个色相相距不远，配色观感统一而不跳脱。
 */
export function colorsFor(seed: string): CoverColors {
    const hue = hueFor(seed);
    const hue2 = (hue + 40) % 360;
    return {
        hue,
        from: `hsl(${hue}, 62%, 58%)`,
        to: `hsl(${hue2}, 58%, 44%)`,
    };
}

/**
 * 取标题首字符：中文取第一个字，英文取首字母大写
 */
export function initialFrom(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) return '?';
    const first = Array.from(trimmed)[0];
    return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}

/** XML 文本转义，避免标题里的 & < > 破坏 SVG */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * 把 SVG 字符串编码为 data URL
 *
 * 走 base64 而不是百分号编码：SVG 里的 `#`（颜色值、url(#id) 引用）
 * 在百分号编码下容易被当成 URL 片段起始符截断，转义顺序稍有不慎就出错。
 * base64 同步可算，且不涉及任何字符歧义。
 */
function svgToDataUrl(svg: string): string {
    const bytes = new TextEncoder().encode(svg);
    let binary = '';
    const CHUNK = 0x8000;
    // 分块拼接，避免超出 apply 的参数上限
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * 生成封面 SVG 的 data URL
 *
 * 有图标时居中放图标，否则放标题首字符——两种情况下底色都由域名决定。
 */
export function generateCoverDataUrl(node: Pick<Node, 'title' | 'url' | 'id' | 'iconUrl'>): string {
    const seed = colorSeedFor(node.url, node.id);
    const { from, to } = colorsFor(seed);

    const inner = node.iconUrl
        ? `<image href="${escapeXml(node.iconUrl)}" x="88" y="88" width="64" height="64" ` +
          `preserveAspectRatio="xMidYMid meet" />`
        : `<text x="120" y="120" text-anchor="middle" dominant-baseline="central" ` +
          `font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="600" ` +
          `fill="rgba(255,255,255,0.92)">${escapeXml(initialFrom(node.title))}</text>`;

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0%" stop-color="${from}"/>` +
        `<stop offset="100%" stop-color="${to}"/>` +
        `</linearGradient></defs>` +
        `<rect width="240" height="240" fill="url(#g)"/>` +
        inner +
        `</svg>`;

    return svgToDataUrl(svg);
}

/**
 * 为节点补上生成封面
 *
 * 已有封面（手动上传、抓取到的 og:image）不动，只处理没有封面的书签。
 * 返回需要写回的字段，无变化时返回 null，避免产生空的历史记录。
 */
export function withGeneratedCover(node: Node): { coverUrl: string; coverType: 'generated' } | null {
    if (node.type !== 'bookmark') return null;
    if (node.coverUrl) return null;
    return {
        coverUrl: generateCoverDataUrl(node),
        coverType: 'generated',
    };
}
