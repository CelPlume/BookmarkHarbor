/**
 * 排序键生成器测试
 */

import { describe, it, expect } from 'vitest';
import { generateOrderKey, generateOrderKeys, rebalanceOrderKeys } from '../core/orderKey';

describe('generateOrderKey', () => {
    it('should generate a key between empty strings', () => {
        const key = generateOrderKey('', '');
        expect(key).toBe('a0');
    });

    it('should generate a key after a given key', () => {
        const key = generateOrderKey('a0', '');
        expect(key > 'a0').toBe(true);
    });

    it('should generate a key before a given key', () => {
        const key = generateOrderKey('', 'a0');
        expect(key < 'a0').toBe(true);
    });

    it('should generate a key between two keys', () => {
        const key = generateOrderKey('a0', 'b0');
        expect(key > 'a0').toBe(true);
        expect(key < 'b0').toBe(true);
    });

    it('should generate keys in correct order', () => {
        const keys: string[] = [];
        let prev = '';

        for (let i = 0; i < 10; i++) {
            const key = generateOrderKey(prev, '');
            keys.push(key);
            prev = key;
        }

        for (let i = 1; i < keys.length; i++) {
            expect(keys[i] > keys[i - 1]).toBe(true);
        }
    });
});

describe('generateOrderKeys', () => {
    it('should generate correct number of keys', () => {
        const keys = generateOrderKeys(5);
        expect(keys).toHaveLength(5);
    });

    it('should generate keys in ascending order', () => {
        const keys = generateOrderKeys(10);

        for (let i = 1; i < keys.length; i++) {
            expect(keys[i] > keys[i - 1]).toBe(true);
        }
    });

    it('should return empty array for count 0', () => {
        const keys = generateOrderKeys(0);
        expect(keys).toHaveLength(0);
    });
});

describe('rebalanceOrderKeys', () => {
    it('should rebalance keys evenly', () => {
        const nodes = [
            { id: 'a', orderKey: 'a0' },
            { id: 'b', orderKey: 'a0a0' },
            { id: 'c', orderKey: 'a0a0a0' },
        ];

        const result = rebalanceOrderKeys(nodes);

        expect(Object.keys(result)).toHaveLength(3);

        const values = Object.values(result);
        for (let i = 1; i < values.length; i++) {
            expect(values[i] > values[i - 1]).toBe(true);
        }
    });

    it('不改变节点的相对顺序', () => {
        const nodes = [
            { id: 'c', orderKey: 'a3' },
            { id: 'a', orderKey: 'a1' },
            { id: 'b', orderKey: 'a2' },
        ];

        const result = rebalanceOrderKeys(nodes);
        expect(result.a < result.b).toBe(true);
        expect(result.b < result.c).toBe(true);
    });

    it('节点数达到 62 时仍然互不相同（原实现会全部返回 "00"）', () => {
        const nodes = Array.from({ length: 62 }, (_, i) => ({
            id: `n${i}`,
            orderKey: 'a' + i.toString(36),
        }));

        const result = rebalanceOrderKeys(nodes);
        const values = Object.values(result);

        expect(new Set(values).size).toBe(62);
    });

    it('节点数远超 62 时仍然保持严格递增且互不相同', () => {
        const nodes = Array.from({ length: 500 }, (_, i) => ({
            id: `n${i}`,
            orderKey: String(i).padStart(6, '0'),
        }));

        const result = rebalanceOrderKeys(nodes);
        const values = Object.values(result);

        expect(new Set(values).size).toBe(500);
        for (let i = 1; i < values.length; i++) {
            expect(values[i] > values[i - 1]).toBe(true);
        }
    });

    it('生成的键长度一致（等长才能按字符串比较）', () => {
        const nodes = Array.from({ length: 100 }, (_, i) => ({
            id: `n${i}`,
            orderKey: String(i),
        }));

        const values = Object.values(rebalanceOrderKeys(nodes));
        const lengths = new Set(values.map(v => v.length));

        expect(lengths.size).toBe(1);
    });

    it('空数组返回空映射', () => {
        expect(rebalanceOrderKeys([])).toEqual({});
    });

    it('单个节点也能得到合法键', () => {
        const result = rebalanceOrderKeys([{ id: 'only', orderKey: 'zzz' }]);
        expect(result.only).toHaveLength(2);
    });

    it('重排后键仍可用于后续插入（不依赖 midpoint 的边界情形）', () => {
        const nodes = Array.from({ length: 200 }, (_, i) => ({
            id: `n${i}`,
            orderKey: String(i),
        }));

        const result = rebalanceOrderKeys(nodes);
        const values = Object.values(result).sort();

        // 在最后一个键之后追加，这是最常用的插入路径
        const appended = generateOrderKey(values[values.length - 1], '');
        expect(appended > values[values.length - 1]).toBe(true);
    });

    it('重排结果不含非法字符，长度一致', () => {
        const nodes = Array.from({ length: 150 }, (_, i) => ({
            id: `n${i}`,
            orderKey: String(i),
        }));

        const values = Object.values(rebalanceOrderKeys(nodes));
        const lengths = new Set(values.map(v => v.length));

        expect(lengths.size).toBe(1);
        expect(values.every(v => /^[0-9A-Za-z]+$/.test(v))).toBe(true);
    });
});
