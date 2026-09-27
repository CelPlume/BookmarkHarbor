/**
 * 加密保险库测试
 *
 * 加解密逻辑用低迭代数跑（测试里跑 60 万次会等到天荒地老），
 * 但默认迭代数本身单列一条断言，避免有人手滑调低而没人发现。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    PBKDF2_ITERATIONS,
    VAULT_FORMAT,
    deriveKey,
    encryptData,
    decryptData,
    looksLikeVault,
    isVaultSupported,
    assessPassphrase,
} from '../core/vault';

/** 测试专用迭代数：够验证流程，又不会拖慢用例 */
const TEST_ITERATIONS = 1000;

beforeAll(() => {
    // jsdom 不带 WebCrypto，用 Node 的实现补上
    if (!globalThis.crypto?.subtle) {
        const { webcrypto } = require('node:crypto');
        Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
    }
});

describe('加密参数', () => {
    it('默认迭代数为 60 万（改动需显式确认）', () => {
        expect(PBKDF2_ITERATIONS).toBe(600_000);
    });

    it('格式标识带版本号，便于将来换算法', () => {
        expect(VAULT_FORMAT).toBe('bookmarkharbor-vault-v1');
    });
});

describe('isVaultSupported', () => {
    it('补齐 WebCrypto 后返回 true', () => {
        expect(isVaultSupported()).toBe(true);
    });
});

describe('deriveKey', () => {
    it('同口令同盐派生出一致的密钥（能互相解密）', async () => {
        const salt = new Uint8Array(16).fill(7);
        const key1 = await deriveKey('口令', salt, TEST_ITERATIONS);

        const plaintext = new TextEncoder().encode('测试内容');
        const iv = new Uint8Array(12).fill(1);
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, plaintext);

        const key2 = await deriveKey('口令', salt, TEST_ITERATIONS);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, ciphertext);

        expect(new TextDecoder().decode(decrypted)).toBe('测试内容');
    });

    it('不同盐派生出不同密钥（解密会失败）', async () => {
        const plaintext = new TextEncoder().encode('测试内容');
        const iv = new Uint8Array(12).fill(1);

        const key1 = await deriveKey('口令', new Uint8Array(16).fill(1), TEST_ITERATIONS);
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, plaintext);

        const key2 = await deriveKey('口令', new Uint8Array(16).fill(2), TEST_ITERATIONS);
        await expect(
            crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, ciphertext)
        ).rejects.toThrow();
    });
});

describe('encryptData / decryptData 往返', () => {
    it('加密后能用同一口令解回原数据', async () => {
        const payload = { nodes: { a: { title: '书签' } }, count: 42 };
        const vault = await encryptData(payload, '正确口令', TEST_ITERATIONS);

        expect(await decryptData(vault, '正确口令')).toEqual(payload);
    });

    it('支持中文与 emoji', async () => {
        const payload = { title: '前端开发 🎯', tags: ['设计', '工具'] };
        const vault = await encryptData(payload, '口令', TEST_ITERATIONS);

        expect(await decryptData(vault, '口令')).toEqual(payload);
    });

    it('密文里不含明文内容', async () => {
        const vault = await encryptData({ secret: '机密书签标题' }, '口令', TEST_ITERATIONS);
        const raw = JSON.stringify(vault);

        expect(raw).not.toContain('机密书签标题');
        expect(raw).not.toContain('secret');
    });

    it('同一数据加密两次得到不同密文（盐与 IV 每次都换）', async () => {
        const payload = { a: 1 };
        const v1 = await encryptData(payload, '口令', TEST_ITERATIONS);
        const v2 = await encryptData(payload, '口令', TEST_ITERATIONS);

        expect(v1.data).not.toBe(v2.data);
        expect(v1.salt).not.toBe(v2.salt);
        expect(v1.iv).not.toBe(v2.iv);
    });

    it('IV 复用的风险已被避免：两次加密的 IV 不同', async () => {
        const a = await encryptData({ x: 1 }, 'p', TEST_ITERATIONS);
        const b = await encryptData({ x: 2 }, 'p', TEST_ITERATIONS);

        expect(a.iv).not.toBe(b.iv);
    });

    it('口令错误时抛出 WRONG_PASSPHRASE', async () => {
        const vault = await encryptData({ a: 1 }, '正确口令', TEST_ITERATIONS);

        await expect(decryptData(vault, '错误口令')).rejects.toThrow('WRONG_PASSPHRASE');
    });

    it('密文被篡改时解密失败（AES-GCM 完整性校验）', async () => {
        const vault = await encryptData({ a: 1 }, '口令', TEST_ITERATIONS);

        // 改动密文末尾一个字符
        const tampered = { ...vault, data: vault.data.slice(0, -4) + 'AAAA' };
        await expect(decryptData(tampered, '口令')).rejects.toThrow('WRONG_PASSPHRASE');
    });

    it('格式标识不匹配时抛 UNSUPPORTED_FORMAT', async () => {
        const vault = await encryptData({ a: 1 }, '口令', TEST_ITERATIONS);
        const wrong = { ...vault, format: 'some-other-format' as typeof VAULT_FORMAT };

        await expect(decryptData(wrong, '口令')).rejects.toThrow('UNSUPPORTED_FORMAT');
    });

    it('迭代数随密文存储，旧数据在默认值调整后仍能解开', async () => {
        const vault = await encryptData({ a: 1 }, '口令', TEST_ITERATIONS);
        expect(vault.iterations).toBe(TEST_ITERATIONS);

        // 模拟"将来默认值调高了"，但旧密文仍按它自己的迭代数解
        expect(await decryptData(vault, '口令')).toEqual({ a: 1 });
    });

    it('能加密空对象与嵌套结构', async () => {
        const payload = { rules: [], nested: { deep: { value: [1, 2, 3] } } };
        const vault = await encryptData(payload, '口令', TEST_ITERATIONS);

        expect(await decryptData(vault, '口令')).toEqual(payload);
    });
});

describe('looksLikeVault', () => {
    it('识别合法的密文结构', async () => {
        const vault = await encryptData({ a: 1 }, '口令', TEST_ITERATIONS);
        expect(looksLikeVault(vault)).toBe(true);
    });

    it('拒绝普通数据', () => {
        expect(looksLikeVault({ version: 2, nodes: {} })).toBe(false);
        expect(looksLikeVault(null)).toBe(false);
        expect(looksLikeVault('字符串')).toBe(false);
        expect(looksLikeVault(undefined)).toBe(false);
    });

    it('缺字段的伪密文被拒绝', () => {
        expect(looksLikeVault({ format: VAULT_FORMAT, salt: 'x' })).toBe(false);
    });
});

describe('assessPassphrase', () => {
    it('短口令判为弱', () => {
        expect(assessPassphrase('abc').level).toBe('weak');
        expect(assessPassphrase('12345678').level).toBe('weak');
    });

    it('纯小写长口令仍判为弱（长度不能弥补字符种类单一）', () => {
        expect(assessPassphrase('abcdefghijkl').level).toBe('weak');
    });

    it('中等口令判为一般', () => {
        // 11 位、含小写与数字，种类够但长度不足
        expect(assessPassphrase('abcdefg12345').level).toBe('fair');
    });

    it('长且多类的口令判为强', () => {
        expect(assessPassphrase('Tr0ub4dor&3xyz').level).toBe('strong');
    });

    it('空口令判为弱', () => {
        expect(assessPassphrase('').level).toBe('weak');
    });
});
