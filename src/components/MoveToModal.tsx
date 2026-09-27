/**
 * MoveToModal 组件 - 选择目标文件夹
 *
 * 供右键菜单的"移动到"使用。列出全部文件夹并排除非法目标：
 * 节点自身、它自己的子孙目录（否则会形成循环）、以及它当前所在的文件夹
 * （移到自己所在的文件夹没有意义）。
 */

import React, { useMemo, useState } from 'react';
import { Button, Modal } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import type { Node } from '../core/types';
import { getDescendantIds } from '../core/cycleDetection';
import { cn } from '../core/utils';

interface MoveToModalProps {
    isOpen: boolean;
    nodes: Record<string, Node>;
    /** 本次要移动的节点 */
    movingIds: string[];
    onClose: () => void;
    onMove: (targetFolderId: string) => void;
}

interface FolderOption {
    id: string;
    title: string;
    depth: number;
    isCurrentParent: boolean;
}

export const MoveToModal: React.FC<MoveToModalProps> = ({
    isOpen,
    nodes,
    movingIds,
    onClose,
    onMove,
}) => {
    const { t } = useTranslation();
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const options = useMemo<FolderOption[]>(() => {
        // 非法目标：被移动的节点自身及其全部子孙
        const blocked = new Set<string>();
        movingIds.forEach(id => {
            blocked.add(id);
            if (nodes[id]?.type === 'folder') {
                getDescendantIds(nodes, id).forEach(descendantId => blocked.add(descendantId));
            }
        });

        // 被移动节点的当前父文件夹，用于置灰提示
        const currentParentIds = new Set(
            movingIds.map(id => nodes[id]?.parentId).filter((pid): pid is string => Boolean(pid))
        );

        const result: FolderOption[] = [];

        const walk = (parentId: string | null, depth: number) => {
            Object.values(nodes)
                .filter(n => n.type === 'folder' && n.parentId === parentId && !n.deletedAt)
                .sort((a, b) => a.orderKey.localeCompare(b.orderKey))
                .forEach(folder => {
                    if (!blocked.has(folder.id)) {
                        result.push({
                            id: folder.id,
                            title: folder.title,
                            depth,
                            isCurrentParent: currentParentIds.has(folder.id),
                        });
                    }
                    walk(folder.id, depth + 1);
                });
        };

        walk('root', 0);
        return result;
    }, [nodes, movingIds]);

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    setSelectedId(null);
                    onClose();
                }
            }}
        >
            <Modal.Backdrop variant="blur">
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.Header className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <Icon icon="lucide:folder-input" className="w-5 h-5" aria-hidden="true" />
                                {t('contextMenu.moveTo')}
                            </div>
                        </Modal.Header>

                        <Modal.Body className="gap-3">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {t('moveTo.hint', { count: movingIds.length })}
                            </p>

                            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10">
                                {options.length === 0 ? (
                                    <div className="py-8 text-center text-sm text-gray-500">
                                        {t('moveTo.empty')}
                                    </div>
                                ) : (
                                    options.map(option => {
                                        const isSelected = selectedId === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setSelectedId(option.id)}
                                                className={cn(
                                                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                                                    'border-b border-gray-100 dark:border-white/5 last:border-b-0',
                                                    isSelected
                                                        ? 'bg-[rgb(var(--color-primary-100-rgb))] text-[rgb(var(--color-primary-700-rgb))] font-medium'
                                                        : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                                )}
                                                style={{ paddingLeft: `${12 + option.depth * 16}px` }}
                                            >
                                                <Icon
                                                    icon="lucide:folder"
                                                    className="w-4 h-4 flex-shrink-0 text-amber-500"
                                                    aria-hidden="true"
                                                />
                                                <span className="truncate flex-1">{option.title}</span>
                                                {option.isCurrentParent && (
                                                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                                                        {t('moveTo.current')}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </Modal.Body>

                        <Modal.Footer>
                            <Button variant="tertiary" onPress={onClose}>
                                {t('duplicates.cancel')}
                            </Button>
                            <Button
                                variant="primary"
                                isDisabled={selectedId === null}
                                onPress={() => {
                                    if (selectedId) onMove(selectedId);
                                    setSelectedId(null);
                                    onClose();
                                }}
                            >
                                {t('moveTo.confirm')}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
};
