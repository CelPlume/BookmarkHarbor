/**
 * DuplicatesModal 组件 - 重复书签检测与合并
 *
 * 列出规范化后指向同一页面的书签分组，选择保留策略后整批合并。
 * 合并结果作为一次历史记录，可整体撤销。
 */

import React, { useMemo, useState } from 'react';
import { Button, Modal, Select, ListBox } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import type { Node } from '../core/types';
import { findDuplicateGroups, planMergeAll, type MergeStrategy } from '../core/dedupe';
import { cn } from '../core/utils';

interface DuplicatesModalProps {
    isOpen: boolean;
    nodes: Record<string, Node>;
    onClose: () => void;
    onMerge: (plans: ReturnType<typeof planMergeAll>) => void;
}

export const DuplicatesModal: React.FC<DuplicatesModalProps> = ({
    isOpen,
    nodes,
    onClose,
    onMerge,
}) => {
    const { t } = useTranslation();
    const [strategy, setStrategy] = useState<MergeStrategy>('oldest');

    const groups = useMemo(() => findDuplicateGroups(nodes), [nodes]);
    const plans = useMemo(() => planMergeAll(groups, strategy), [groups, strategy]);

    const duplicateCount = groups.reduce((sum, group) => sum + group.nodes.length, 0);
    const removableCount = plans.reduce((sum, plan) => sum + plan.removeIds.length, 0);

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal.Backdrop variant="blur">
                <Modal.Container size="lg">
                    <Modal.Dialog>
                        <Modal.Header className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <Icon icon="lucide:copy-check" className="w-5 h-5" aria-hidden="true" />
                                {t('duplicates.title')}
                            </div>
                        </Modal.Header>

                        <Modal.Body className="gap-5">
                            {groups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                                    <Icon
                                        icon="lucide:circle-check"
                                        className="w-10 h-10 text-success-500"
                                        aria-hidden="true"
                                    />
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {t('duplicates.none')}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {t('duplicates.summary', {
                                            groups: groups.length,
                                            total: duplicateCount,
                                            removable: removableCount,
                                        })}
                                    </p>

                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm">{t('duplicates.strategy')}</span>
                                        <Select
                                            selectedKey={strategy}
                                            onSelectionChange={(key) => {
                                                if (key) setStrategy(key as MergeStrategy);
                                            }}
                                            className="w-56"
                                            aria-label={t('duplicates.strategy')}
                                        >
                                            <Select.Trigger>
                                                <Select.Value className="flex items-center gap-2" />
                                                <Select.Indicator />
                                            </Select.Trigger>
                                            <Select.Popover>
                                                <ListBox>
                                                    <ListBox.Item id="oldest" textValue={t('duplicates.strategyOldest')}>
                                                        {t('duplicates.strategyOldest')}
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                    <ListBox.Item id="newest" textValue={t('duplicates.strategyNewest')}>
                                                        {t('duplicates.strategyNewest')}
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                    <ListBox.Item id="richest" textValue={t('duplicates.strategyRichest')}>
                                                        {t('duplicates.strategyRichest')}
                                                        <ListBox.ItemIndicator />
                                                    </ListBox.Item>
                                                </ListBox>
                                            </Select.Popover>
                                        </Select>
                                    </div>

                                    <p className="text-xs text-gray-500">
                                        {t(`duplicates.${strategy}Hint`)}
                                    </p>

                                    <div className="space-y-3">
                                        {groups.map((group, index) => {
                                            const plan = plans[index];
                                            return (
                                                <div
                                                    key={group.key}
                                                    className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden"
                                                >
                                                    <div className="px-3 py-2 bg-gray-50 dark:bg-white/5 text-xs font-mono text-gray-500 truncate">
                                                        {group.key}
                                                    </div>
                                                    <div className="divide-y divide-gray-100 dark:divide-white/5">
                                                        {group.nodes.map(node => {
                                                            const isKept = node.id === plan?.keepId;
                                                            return (
                                                                <div
                                                                    key={node.id}
                                                                    className="flex items-center gap-2 px-3 py-2 text-sm"
                                                                >
                                                                    <Icon
                                                                        icon={isKept ? 'lucide:check-circle-2' : 'lucide:trash-2'}
                                                                        className={cn(
                                                                            'w-4 h-4 flex-shrink-0',
                                                                            isKept ? 'text-success-500' : 'text-gray-400'
                                                                        )}
                                                                        aria-hidden="true"
                                                                    />
                                                                    <span className="truncate flex-1 text-gray-900 dark:text-gray-100">
                                                                        {node.title}
                                                                    </span>
                                                                    <span
                                                                        className={cn(
                                                                            'text-[11px] flex-shrink-0',
                                                                            isKept ? 'text-success-600' : 'text-gray-400'
                                                                        )}
                                                                    >
                                                                        {isKept
                                                                            ? t('duplicates.keep')
                                                                            : t('duplicates.remove')}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                        <div className="px-3 py-2 text-[11px] text-gray-500 bg-gray-50/50 dark:bg-white/[0.02]">
                                                            {t('duplicates.mergeNote')}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </Modal.Body>

                        <Modal.Footer>
                            <Button variant="tertiary" onPress={onClose}>
                                {t('duplicates.cancel')}
                            </Button>
                            <Button
                                variant="primary"
                                isDisabled={plans.length === 0}
                                onPress={() => {
                                    onMerge(plans);
                                    onClose();
                                }}
                            >
                                {t('duplicates.merge', { count: removableCount })}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
};
