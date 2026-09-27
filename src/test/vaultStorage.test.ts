/**
 * 保险库与存储层的集成测试
 *
 * 重点是"开关加密之后，数据还在不在"：
 * 加密切换涉及删明文键、换存储格式、内存与磁盘两份状态，
 * 任何一步写错都会让用户的收藏凭空消失。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'aurabookmarks_data';
const SETTINGS_KEY = 'aurabookmarks_settings';

let getStorage: typeof import('../core/storage/localStorage').getStorage;

beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();

    if (!globalThis.crypto?.subtle) {
        const { webcrypto } = require('node:crypto');
        Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
    }

    const mod = await import('../core/storage/localStorage');
    getStorage = mod.getStorage;
});

/** 造一份带书签的明文数据 */
function seedPlainData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        nodes: {
            root: { id: 'root', type: 'folder', parentId: null, title: 'All Bookmarks', orderKey: 'a0', createdAt: 1, updatedAt: 1 },
            b1: { id: 'b1', type: 'bookmark', parentId: 'root', title: '机密书签', url: 'https://secret.example.com', orderKey: 'a1', tags: ['私密'], createdAt: 2, updatedAt: 2 },
        },
        assets: {},
        metadataCache: {},
        rules: [],
        settings: { theme: 'dark', locale: 'zh', viewMode: 'card' },
    }));
}

describe('未启用加密时', () => {
    it('isEncrypted 为 false，isUnlocked 为 true', () => {
        seedPlainData();
        const storage = getStorage();
        expect(storage.isEncrypted()).toBe(false);
        expect(storage.isUnlocked()).toBe(true);
    });

    it('数据按明文存储，可正常读取', () => {
        seedPlainData();
        const storage = getStorage();
        expect(storage.getAllNodes().b1?.title).toBe('机密书签');
    });

    it('保存时同步写入明文设置键（供解锁前读取界面语言）', () => {
        seedPlainData();
        getStorage().updateNode('b1', { title: '改过名' });
        expect(localStorage.getItem(SETTINGS_KEY)).toBeTruthy();
    });
});

describe('启用加密', () => {
    it('存储格式变成密文，明文内容消失', async () => {
        seedPlainData();
        const storage = getStorage();
        // 绕过 PBKDF2 的高迭代数：直接调底层加密
        await storage.enableEncryption('正确口令');

        const raw = localStorage.getItem(STORAGE_KEY) ?? '';
        expect(raw).toContain('bookmarkharbor-vault-v1');
        expect(raw).not.toContain('机密书签');
        expect(raw).not.toContain('secret.example.com');
    });

    it('启用后仍处于解锁态，内存数据可用', async () => {
        seedPlainData();
        const storage = getStorage();
        await storage.enableEncryption('口令');

        expect(storage.isEncrypted()).toBe(true);
        expect(storage.isUnlocked()).toBe(true);
        expect(storage.getAllNodes().b1?.title).toBe('机密书签');
    });

    it('设置保持明文，锁定后仍能读到界面语言', async () => {
        seedPlainData();
        const storage = getStorage();
        await storage.enableEncryption('口令');

        const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
        expect(settings.locale).toBe('zh');
    });
});

describe('锁定与解锁', () => {
    it('锁定后内存数据清空，isUnlocked 变 false', async () => {
        seedPlainData();
        const storage = getStorage();
        await storage.enableEncryption('口令');

        storage.lock();

        expect(storage.isUnlocked()).toBe(false);
        expect(storage.getAllNodes().b1).toBeUndefined();
    });

    it('锁定后仍保留设置（界面不能失去语言与主题）', async () => {
        seedPlainData();
        const storage = getStorage();
        await storage.enableEncryption('口令');
        storage.lock();

        expect(storage.getSettings().locale).toBe('zh');
    });

    it('用正确口令解锁后数据完整回来', async () => {
        seedPlainData();
        const storage = getStorage();
        await storage.enableEncryption('口令');
        storage.lock();

        await storage.unlock('口令');

        expect(storage.isUnlocked()).toBe(true);
        expect(storage.getAllNodes().b1?.title).toBe('机密书签');
        expect(storage.getAllNodes().b1?.url).toBe('https://secret.example.com');
        expect(storage.getAllNodes().b1?.tags).toEqual(['私密']);
    });

    it('口令错误时抛错，且保持锁定态', async () => {
        seedPlainData();
        const storage = getStorage();
        await storage.enableEncryption('正确口令');
        storage.lock();

        await expect(storage.unlock('错误口令')).rejects.toThrow('WRONG_PASSPHRASE');
        expect(storage.isUnlocked()).toBe(false);
        expect(storage.getAllNodes().b1).toBeUndefined();
    });
});

describe('加密状态下编辑', () => {
    it('修改能落盘，重新解锁后读到的是新值', async () => {
        seedPlainData();
        const storage = getStorage();
        await storage.enableEncryption('口令');

        storage.updateNode('b1', { title: '改过的标题' });
        // 等异步写入队列排空
        await new Promise(resolve => setTimeout(resolve, 200));

        storage.lock();
        await storage.unlock('口令');

        expect(storage.getAllNodes().b1?.title).toBe('改过的标题');
    });

    it('锁定状态下的修改不落盘（内存里是默认数据，写下去会覆盖真实密文）', async () => {
        seedPlainData();
        const storage = getStorage();
        await storage.enableEncryption('口令');
        const before = localStorage.getItem(STORAGE_KEY);

        storage.lock();
        storage.updateNode('b1', { title: '不该被写入' });
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    });
});

describe('关闭加密', () => {
    it('口令正确时写回明文，数据保留', async () => {
        seedPlainData();
        const storage = getStorage();
        await storage.enableEncryption('口令');

        await storage.disableEncryption('口令');

        expect(storage.isEncrypted()).toBe(false);
        const raw = localStorage.getItem(STORAGE_KEY) ?? '';
        expect(raw).toContain('机密书签');
        expect(raw).not.toContain('bookmarkharbor-vault-v1');
    });

    it('口令错误时拒绝关闭，保持加密', async () => {
        seedPlainData();
        const storage = getStorage();
        await storage.enableEncryption('正确口令');

        await expect(storage.disableEncryption('错误口令')).rejects.toThrow('WRONG_PASSPHRASE');
        expect(storage.isEncrypted()).toBe(true);
    });
});
