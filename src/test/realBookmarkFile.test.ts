/**
 * 用真实浏览器导出文件做冒烟测试
 *
 * 单元测试用的是手写小样本，覆盖不到真实导出文件的噪声：
 * Firefox 会写入 place: / javascript: 协议、base64 内嵌图标、
 * PERSONAL_TOOLBAR_FOLDER 私有属性，以及单行极长的内容。
 *
 * 这里用一份 2.2MB 的真实导出（1700+ 书签、80+ 文件夹）跑一遍解析器。
 *
 * 样本文件体积大且含个人数据，不放仓库；找不到时整体跳过。
 * 需要时可用 BOOKMARK_SAMPLE 环境变量指定其他文件来跑。
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parseBookmarkHtml, type ParsedItem } from '../core/importExport/htmlParser';

const SAMPLE = process.env.BOOKMARK_SAMPLE
    || 'D:/install/wx/chat/xwechat_files/wxid_8hmxdfv7cbcl22_b3e6/temp/RWTemp/2026-09/9e20f478899dc29eb19741386f9343c8/奶酪书签专业版 2018-11-01(1).html';

const hasSample = existsSync(SAMPLE);
const html = hasSample ? readFileSync(SAMPLE, 'utf-8') : '';

/** 解析结果是嵌套树，统计时要递归展开 */
function flatten(items: ParsedItem[]): ParsedItem[] {
    return items.flatMap(item => [item, ...flatten(item.children)]);
}

describe.skipIf(!hasSample)('真实浏览器导出文件冒烟测试', () => {
    it('解析不抛异常', () => {
        expect(() => parseBookmarkHtml(html)).not.toThrow();
    });

    it('解析出全部条目：文件夹与书签都被识别', () => {
        const items = flatten(parseBookmarkHtml(html));

        const folders = items.filter(i => i.type === 'folder');
        const bookmarks = items.filter(i => i.type === 'bookmark');

        expect(folders.length).toBeGreaterThan(50);
        expect(bookmarks.length).toBeGreaterThan(1000);
    });

    it('层级被保留，且嵌套不止一层', () => {
        const items = parseBookmarkHtml(html);

        const depthOf = (list: ParsedItem[], depth: number): number =>
            list.reduce(
                (max, item) => Math.max(max, depth, depthOf(item.children, depth + 1)),
                0
            );

        expect(depthOf(items, 0)).toBeGreaterThan(1);
    });

    it('每个条目都有标题（真实导出不应出现空标题）', () => {
        const items = flatten(parseBookmarkHtml(html));
        const missing = items.filter(i => !i.title || i.title.trim().length === 0);

        expect(missing).toHaveLength(0);
    });

    it('书签都带有 url', () => {
        const items = flatten(parseBookmarkHtml(html));
        const bookmarks = items.filter(i => i.type === 'bookmark');

        expect(bookmarks.every(b => typeof b.url === 'string' && b.url.length > 0)).toBe(true);
    });

    it('文件夹不携带 url', () => {
        const items = flatten(parseBookmarkHtml(html));
        const folders = items.filter(i => i.type === 'folder');

        expect(folders.every(f => !f.url)).toBe(true);
    });

    it('解析出真实文件里的备注、标签与图标', () => {
        const items = flatten(parseBookmarkHtml(html));

        // 这三个字段是导入链路的重点，真实文件里都有样本
        expect(items.filter(i => i.notes).length).toBeGreaterThan(0);
        expect(items.filter(i => i.iconUrl).length).toBeGreaterThan(0);
        expect(items.filter(i => i.tags && i.tags.length > 0).length).toBeGreaterThan(0);
    });

    it('非 http 链接（place: / javascript: / data:）占比不高', () => {
        const items = flatten(parseBookmarkHtml(html));
        const bookmarks = items.filter(i => i.type === 'bookmark');
        const nonHttp = bookmarks.filter(b => !/^https?:/i.test(b.url ?? ''));

        // 这类链接来自 Firefox 内置智能文件夹与书签小程序，
        // 真实文件里是小众；若解析器把大段内容错认成书签，这里会暴露
        expect(nonHttp.length / bookmarks.length).toBeLessThan(0.2);
    });
});
