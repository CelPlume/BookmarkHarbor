/**
 * 本地加密保险库（纯逻辑，不依赖框架）
 *
 * 用 WebCrypto 的 AES-GCM 加密书签数据，密钥由用户口令经 PBKDF2 派生。
 * 口令本身不落盘，派生出的密钥只存在于内存中，锁定时丢弃。
 *
 * 定位上这是本软件最"本地优先"的一条：数据本来就只存在浏览器里，
 * 加密之后即使有人拿到这台机器的存储，没有口令也读不出来。
 *
 * 安全边界（写清楚，避免高估）：
 * - 口令强度决定一切。弱口令能被离线爆破，PBKDF2 只是抬高成本
 * - 忘记口令 = 数据永久不可恢复，没有后门、没有找回流程
 * - 加密只覆盖 nodes / assets / metadataCache；settings 保持明文，
 *   因为界面语言、主题必须在解锁前就能读到
 */

/** PBKDF2 迭代次数。调高更安全但解锁更慢，60 万次在现代设备约 0.3-1 秒 */
export const PBKDF2_ITERATIONS = 600_000;

/** 盐长与 IV 长（字节） */
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** 加密封装体的格式标识，便于将来换算法时识别旧数据 */
export const VAULT_FORMAT = 'bookmarkharbor-vault-v1';

/** 落盘的密文结构 */
export interface EncryptedVault {
    format: typeof VAULT_FORMAT;
    /** base64 的随机盐，每次设置口令都重新生成 */
    salt: string;
    /** base64 的随机初始向量，每次保存都重新生成 */
    iv: string;
    /** base64 的密文（AES-GCM 自带完整性校验） */
    data: string;
    /** 派生参数，随数据一起存，便于将来调整迭代次数后仍能解开旧数据 */
    iterations: number;
    updatedAt: number;
}

/** ArrayBuffer / Uint8Array 与 base64 互转 */
export function toBase64(bytes: Uint8Array): string {
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/** 生成密码学安全的随机字节 */
function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

/**
 * 判断当前环境是否支持加密
 *
 * crypto.subtle 只在安全上下文可用：HTTPS 或 localhost。
 * 用 http:// 打开局域网地址时会是 undefined，需要提示用户。
 */
export function isVaultSupported(): boolean {
    return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

/**
 * 由口令派生 AES-GCM 密钥
 *
 * PBKDF2-SHA256 + 随机盐。盐随密文存储，换口令时重新生成。
 */
export async function deriveKey(
    passphrase: string,
    salt: Uint8Array,
    iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * 加密任意可序列化数据
 *
 * 每次调用都生成新的 IV：AES-GCM 重用 IV 会直接毁掉安全性。
 */
export async function encryptData(
    payload: unknown,
    passphrase: string,
    iterations: number = PBKDF2_ITERATIONS
): Promise<EncryptedVault> {
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const key = await deriveKey(passphrase, salt, iterations);

    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        plaintext
    );

    return {
        format: VAULT_FORMAT,
        salt: toBase64(salt),
        iv: toBase64(iv),
        data: toBase64(new Uint8Array(ciphertext)),
        iterations,
        updatedAt: Date.now(),
    };
}

/**
 * 解密
 *
 * 口令错误时 AES-GCM 的完整性校验会失败并抛错——
 * 这正是我们需要的：解不开就说明口令不对，不会返回半截数据。
 */
export async function decryptData<T = unknown>(
    vault: EncryptedVault,
    passphrase: string
): Promise<T> {
    if (vault.format !== VAULT_FORMAT) {
        throw new Error('UNSUPPORTED_FORMAT');
    }

    const salt = fromBase64(vault.salt);
    const iv = fromBase64(vault.iv);
    const key = await deriveKey(passphrase, salt, vault.iterations);

    try {
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv as unknown as BufferSource },
            key,
            fromBase64(vault.data) as unknown as BufferSource
        );
        return JSON.parse(new TextDecoder().decode(plaintext)) as T;
    } catch {
        // 统一成可判断的错误码，界面据此提示"口令错误"
        throw new Error('WRONG_PASSPHRASE');
    }
}

/** 判断一段已解析的 JSON 是不是密文结构 */
export function looksLikeVault(value: unknown): value is EncryptedVault {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<EncryptedVault>;
    return candidate.format === VAULT_FORMAT
        && typeof candidate.salt === 'string'
        && typeof candidate.iv === 'string'
        && typeof candidate.data === 'string'
        && typeof candidate.iterations === 'number';
}

/** 简单评估口令强度，用于界面提示（不阻止使用，只提醒） */
export function assessPassphrase(passphrase: string): {
    level: 'weak' | 'fair' | 'strong';
    suggestion: string;
} {
    const length = passphrase.length;
    const hasLower = /[a-z]/.test(passphrase);
    const hasUpper = /[A-Z]/.test(passphrase);
    const hasDigit = /\d/.test(passphrase);
    const hasSymbol = /[^a-zA-Z0-9]/.test(passphrase);
    const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

    if (length < 8 || variety <= 1) {
        return { level: 'weak', suggestion: 'PASSPHRASE_WEAK' };
    }
    if (length < 12 || variety <= 2) {
        return { level: 'fair', suggestion: 'PASSPHRASE_FAIR' };
    }
    return { level: 'strong', suggestion: 'PASSPHRASE_STRONG' };
}
