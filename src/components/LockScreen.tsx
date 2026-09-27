/**
 * LockScreen - 加密保险库的解锁界面
 *
 * 加密数据在解锁前完全不可用，所以这个界面是进入软件的唯一入口。
 * 设计上刻意保持安静：没有导航、没有搜索、没有其他按钮，
 * 避免用户在锁定状态下误以为数据丢了。
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, TextField, Label, FieldError } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { isVaultSupported } from '../core/vault';

interface LockScreenProps {
    onUnlock: (passphrase: string) => Promise<void>;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
    const { t } = useTranslation();
    const [passphrase, setPassphrase] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const supported = isVaultSupported();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passphrase || busy) return;

        setBusy(true);
        setError(null);
        try {
            await onUnlock(passphrase);
        } catch (err) {
            const code = err instanceof Error ? err.message : '';
            if (code === 'WRONG_PASSPHRASE') {
                setError(t('vault.wrongPassphrase'));
            } else if (code === 'NO_VAULT') {
                setError(t('vault.noVault'));
            } else {
                setError(code || t('vault.wrongPassphrase'));
            }
            setPassphrase('');
            inputRef.current?.focus();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
            <div className="w-full max-w-sm">
                {/* 标识 */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-[rgb(var(--color-primary-100-rgb))] dark:bg-[rgb(var(--color-primary-900-rgb)_/_0.35)] flex items-center justify-center mb-4">
                        <Icon
                            icon="lucide:lock"
                            className="w-7 h-7"
                            style={{ color: 'rgb(var(--color-primary-500-rgb))' }}
                            aria-hidden="true"
                        />
                    </div>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {t('vault.title')}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">{t('vault.subtitle')}</p>
                </div>

                {!supported ? (
                    <div className="rounded-xl border border-warning-200 dark:border-warning-900/50 bg-warning-50 dark:bg-warning-950/30 p-4">
                        <div className="flex gap-2">
                            <Icon icon="lucide:triangle-alert" className="w-5 h-5 text-warning-600 flex-shrink-0" aria-hidden="true" />
                            <p className="text-sm text-warning-800 dark:text-warning-200">
                                {t('vault.unsupported')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <TextField
                            value={passphrase}
                            onChange={setPassphrase}
                            isInvalid={Boolean(error)}
                        >
                            <Label>{t('vault.passphrase')}</Label>
                            <Input
                                ref={inputRef}
                                type="password"
                                name="passphrase"
                                autoComplete="current-password"
                                placeholder={t('vault.passphrasePlaceholder')}
                            />
                            {error && <FieldError>{error}</FieldError>}
                        </TextField>

                        <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            isDisabled={!passphrase || busy}
                            isPending={busy}
                        >
                            {busy ? t('vault.unlocking') : t('vault.unlock')}
                        </Button>
                    </form>
                )}

                {/* 忘记口令的后果必须写在用户看得到的地方 */}
                <div className="mt-6 rounded-xl border border-gray-200 dark:border-white/10 p-4">
                    <div className="flex gap-2">
                        <Icon icon="lucide:info" className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="text-xs text-gray-500 leading-relaxed">
                            {t('vault.warning')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
