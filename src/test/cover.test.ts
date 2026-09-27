/**
 * 确定性封面生成测试
 */

import { describe, it, expect } from 'vitest';
import {
    fnv1a,
    colorSeedFor,
    hueFor,
    colorsFor,
    initialFrom,
    generateCoverDataUrl,
    withGeneratedCover,
} from '../core/cover';
import type { Node } from '../core/types';

function node(overrides: Partial<Node> = {}): Node {
    return {
        id: 'n1',
        type: 'bookmark',
        parentId: 'root',
        title: '示例书签',
        url: 'https://example.com/a',
        orderKey: 'a0',
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

/**
 * 从 data URL 还原出 SVG 源码
 *
 * atob 返回的是 Latin-1 二进制串，中文等多字节内容必须再按 UTF-8 解码，
 * 否则拿到的字符是坏的。
 */
function svgFromDataUrl(dataUrl: string): string {
    const binary = atob(dataUrl.split(',')[1]);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

describe('fnv1a', () => {
    it('对同一输入稳定返回同一结果', () => {
        expect(fnv1a('example.com')).toBe(fnv1a('example.com'));
    });

    it('不同输入返回不同结果', () => {
        expect(fnv1a('a.com')).not.toBe(fnv1a('b.com'));
    });

    it('结果是 32 位无符号整数', () => {
        const hash = fnv1a('任意字符串 with 中文 and symbols !@#$');
        expect(hash).toBeGreaterThanOrEqual(0);
        expect(hash).toBeLessThanOrEqual(0xffffffff);
        expect(Number.isInteger(hash)).toBe(true);
    });

    it('空字符串也有确定结果', () => {
        expect(fnv1a('')).toBe(0x811c9dc5);
    });
});

describe('colorSeedFor', () => {
    it('同一域名的不同写法得到同一种子', () => {
        const a = colorSeedFor('https://example.com/a', 'id1');
        const b = colorSeedFor('HTTP://WWW.example.com/a/?utm_source=q', 'id2');
        expect(a).toBe(b);
        expect(a).toBe('example.com');
    });

    it('不同域名得到不同种子', () => {
        expect(colorSeedFor('https://a.com', 'x')).not.toBe(colorSeedFor('https://b.com', 'x'));
    });

    it('url 缺失或无法解析时回退到提供的 fallback', () => {
        expect(colorSeedFor(undefined, 'node-1')).toBe('node-1');
        expect(colorSeedFor('不是网址', 'node-2')).toBe('node-2');
        expect(colorSeedFor('javascript:alert(1)', 'node-3')).toBe('node-3');
    });
});

describe('hueFor', () => {
    it('色相始终落在 0-359', () => {
        ['a.com', 'b.com', '很长的中文域名', ''].forEach(seed => {
            const hue = hueFor(seed);
            expect(hue).toBeGreaterThanOrEqual(0);
            expect(hue).toBeLessThan(360);
        });
    });

    it('稳定：同一种子同一色相', () => {
        expect(hueFor('example.com')).toBe(hueFor('example.com'));
    });
});

describe('colorsFor', () => {
    it('两个色相相差 40 度', () => {
        const { hue, from, to } = colorsFor('example.com');
        expect(from).toContain(`hsl(${hue}`);
        expect(to).toContain(`hsl(${(hue + 40) % 360}`);
    });
});

describe('initialFrom', () => {
    it('中文取第一个字', () => {
        expect(initialFrom('前端开发')).toBe('前');
    });

    it('英文首字母大写', () => {
        expect(initialFrom('github')).toBe('G');
        expect(initialFrom('GitHub')).toBe('G');
    });

    it('前后空白不影响取字', () => {
        expect(initialFrom('  Vue  ')).toBe('V');
    });

    it('空标题回退为问号', () => {
        expect(initialFrom('')).toBe('?');
        expect(initialFrom('   ')).toBe('?');
    });

    it('emoji 等代理对字符整体取出', () => {
        expect(initialFrom('🎯 目标')).toBe('🎯');
    });
});

describe('generateCoverDataUrl', () => {
    it('返回 SVG 的 data URL', () => {
        const url = generateCoverDataUrl(node());
        expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    });

    it('同一域名生成完全相同的封面', () => {
        const a = generateCoverDataUrl(node({ id: 'a', url: 'https://example.com/x' }));
        const b = generateCoverDataUrl(node({ id: 'b', url: 'HTTP://WWW.example.com/x?utm_source=q' }));
        expect(a).toBe(b);
    });

    it('不同域名生成不同封面', () => {
        const a = generateCoverDataUrl(node({ url: 'https://a.com' }));
        const b = generateCoverDataUrl(node({ url: 'https://b.com' }));
        expect(a).not.toBe(b);
    });

    it('无图标时内嵌标题首字符', () => {
        const url = generateCoverDataUrl(node({ title: '前端开发', iconUrl: undefined }));
        expect(svgFromDataUrl(url)).toContain('前');
    });

    it('有图标时内嵌图标图片', () => {
        const url = generateCoverDataUrl(
            node({ iconUrl: 'https://example.com/favicon.ico' })
        );
        const svg = svgFromDataUrl(url);
        expect(svg).toContain('<image');
        expect(svg).toContain('favicon.ico');
    });

    it('首字符为 XML 特殊字符时被转义，不破坏 SVG', () => {
        const url = generateCoverDataUrl(node({ title: '<安全>' }));
        const svg = svgFromDataUrl(url);
        expect(svg).toContain('&lt;');
        // 文本节点里不应出现未转义的 <
        expect(svg).not.toContain('>A & B<');
    });

    it('图标地址里的 & 被转义为实体', () => {
        const url = generateCoverDataUrl(
            node({ iconUrl: 'https://example.com/i?a=1&b=2.png' })
        );
        const svg = svgFromDataUrl(url);
        expect(svg).toContain('&amp;');
    });

    it('颜色值里的 # 不会截断 data URL（走 base64 编码）', () => {
        const url = generateCoverDataUrl(node());
        // base64 段不应出现裸 #
        expect(url.split(',')[1]).not.toContain('#');
    });
});

describe('withGeneratedCover', () => {
    it('为没有封面的书签生成封面', () => {
        const patch = withGeneratedCover(node());
        expect(patch?.coverType).toBe('generated');
        expect(patch?.coverUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
    });

    it('已有封面时不覆盖', () => {
        expect(withGeneratedCover(node({ coverUrl: 'https://a.com/c.png' }))).toBeNull();
    });

    it('文件夹不生成封面', () => {
        expect(withGeneratedCover(node({ type: 'folder', url: undefined }))).toBeNull();
    });
});
