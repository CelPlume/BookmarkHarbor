/**
 * VaultSetupModal - 启用 / 关闭加密
 *
 * 启用时要走两步：输入口令、再确认一遍。这是不可逆的操作边界，
 * 敲错一个字符就会在下次打开时打不开书签库，值得多一次确认。
 *
 * 关闭同样要求重新输入口令——关闭加密是不可逆的降级，
 * 不该因为界面当前处于解锁态就放行。
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button, Modal, Input, TextField, Label } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { assessPassphrase, isVaultSupported } from '../core/vault';
import { cn } from '../core/utils';

/** 启用口令的最短长度。低于这个长度不该被允许，避免用户把库锁死后自己打不开 */
const MIN_PASSPHRASE_LENGTH = 8;

interface VaultSetupModalProps {
    isOpen: boolean;
    /** 当前是否已启用加密 */
    encrypted: boolean;
    onClose: () => void;
    onEnable: (passphrase: string) => Promise<void>;
    onDisable: (passphrase: string) => Promise<void>;
}

export const VaultSetupModal: React.FC<VaultSetupModalProps> = ({
    isOpen,
    encrypted,
    onClose,
    onEnable,
    onDisable,
}) => {
    const { t } = useTranslation();
    const [passphrase, setPassphrase] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // 每次打开都清空，避免上次输入的残留
    useEffect(() => {
        if (isOpen) {
            setPassphrase('');
            setConfirm('');
            setError(null);
            setBusy(false);
        }
    }, [isOpen]);

    const strength = useMemo(() => assessPassphrase(passphrase), [passphrase]);
    const supported = isVaultSupported();

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;

        if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
            setError(t('vault.passphraseTooShort'));
            return;
        }
        if (!encrypted && passphrase !== confirm) {
            setError(t('vault.passphraseMismatch'));
            return;
        }

        setBusy(true);
        setError(null);
        try {
            if (encrypted) {
                await onDisable(passphrase);
            } else {
                await onEnable(passphrase);
            }
            onClose();
        } catch (err) {
            const code = err instanceof Error ? err.message : '';
            setError(code === 'WRONG_PASSPHRASE' ? t('vault.wrongPassphrase') : code);
        } finally {
            setBusy(false);
        }
    };

    const strengthColor = {
        weak: 'text-danger-500',
        fair: 'text-warning-500',
        strong: 'text-success-500',
    }[strength.level];

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal.Backdrop variant="blur">
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.Header className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <Icon
                                    icon={encrypted ? 'lucide:lock-open' : 'lucide:lock'}
                                    className="w-5 h-5"
                                    aria-hidden="true"
                                />
                                {encrypted ? t('vault.disableTitle') : t('vault.enableTitle')}
                            </div>
                        </Modal.Header>

                        <Modal.Body className="gap-4">
                            {!supported ? (
                                <p className="text-sm text-warning-600 dark:text-warning-400">
                                    {t('vault.unsupported')}
                                </p>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {encrypted ? t('vault.disableHint') : t('vault.enableHint')}
                                    </p>

                                    <form onSubmit={submit} className="space-y-3" id="vault-form">
                                        <TextField value={passphrase} onChange={setPassphrase}>
                                            <Label>{t('vault.passphrase')}</Label>
                                            <Input
                                                ref={inputRef}
                                                type="password"
                                                name="passphrase"
                                                autoComplete="new-password"
                                                placeholder={t('vault.passphrasePlaceholder')}
                                            />
                                        </TextField>

                                        {!encrypted && passphrase.length > 0 && (
                                            <p className={cn('text-xs', strengthColor)}>
                                                {t(`vault.${strength.level === 'weak' ? 'weak' : strength.level === 'fair' ? 'fair' : 'strong'}`)}
                                            </p>
                                        )}

                                        {/* 启用才需要确认；关闭时输一遍即可 */}
                                        {!encrypted && (
                                            <TextField value={confirm} onChange={setConfirm}>
                                                <Label>{t('vault.confirmPassphrase')}</Label>
                                                <Input
                                                    type="password"
                                                    name="confirm"
                                                    autoComplete="new-password"
                                                    placeholder={t('vault.passphrasePlaceholder')}
                                                />
                                            </TextField>
                                        )}

                                        {error && (
                                            <p className="text-xs text-danger-500">{error}</p>
                                        )}
                                    </form>

                                    {/* 启用加密前，把不可恢复的后果说清楚 */}
                                    {!encrypted && (
                                        <div className="rounded-xl border border-warning-200 dark:border-warning-900/50 bg-warning-50 dark:bg-warning-950/30 p-3">
                                            <div className="flex gap-2">
                                                <Icon
                                                    icon="lucide:triangle-alert"
                                                    className="w-4 h-4 text-warning-600 flex-shrink-0 mt-0.5"
                                                    aria-hidden="true"
                                                />
                                                <div>
                                                    <p className="text-xs font-medium text-warning-800 dark:text-warning-200">
                                                        {t('vault.warningTitle')}
                                                    </p>
                                                    <p className="text-xs text-warning-700 dark:text-warning-300 mt-1 leading-relaxed">
                                                        {t('vault.warning')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        {t('vault.noteSettingsPlain')}
                                    </p>
                                </>
                            )}
                        </Modal.Body>

                        <Modal.Footer>
                            <Button variant="tertiary" onPress={onClose}>
                                {t('duplicates.cancel')}
                            </Button>
                            <Button
                                type="submit"
                                form="vault-form"
                                variant={encrypted ? 'danger' : 'primary'}
                                isDisabled={!supported || passphrase.length < MIN_PASSPHRASE_LENGTH || busy}
                                isPending={busy}
                            >
                                {encrypted ? t('vault.disable') : t('vault.enable')}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
};
