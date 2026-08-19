/**
 * SelectionToolbar 组件 - 多选浮动工具条（复刻参考设计）
 */

import React from 'react';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';

interface SelectionToolbarProps {
    selectedCount: number;
    currentView?: 'bookmarks' | 'favorites' | 'readLater' | 'trash';
    onFavorite: () => void;
    onReadLater: () => void;
    onDelete: () => void;
    onRestore?: () => void;
    onClear: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
    selectedCount,
    currentView = 'bookmarks',
    onFavorite,
    onReadLater,
    onDelete,
    onRestore,
    onClear,
}) => {
    const { t } = useTranslation();
    const isTrash = currentView === 'trash';

    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-in">
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-xl border border-gray-200/50 dark:border-white/10 sm:py-1.5">
                {/* Selection count badge */}
                <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 sm:px-3 sm:py-1.5">
                    <span className="text-xs font-semibold sm:text-sm">{selectedCount}</span>
                    <span className="text-[11px] leading-none whitespace-nowrap sm:text-sm">{t('selection.selected')}</span>
                </div>

                <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

                {!isTrash && (
                    <Button
                        variant="tertiary"
                        size="sm"
                        onPress={onFavorite}
                        className="text-gray-600 dark:text-gray-300"
                    >
                        <Icon icon="lucide:star" className="w-4 h-4" aria-hidden="true" />
                        {t('selection.favorite')}
                    </Button>
                )}

                {!isTrash && (
                    <Button
                        variant="tertiary"
                        size="sm"
                        onPress={onReadLater}
                        className="text-gray-600 dark:text-gray-300"
                    >
                        <Icon icon="lucide:clock" className="w-4 h-4" aria-hidden="true" />
                        {t('selection.readLater')}
                    </Button>
                )}

                {isTrash && (
                    <Button
                        variant="tertiary"
                        size="sm"
                        onPress={onRestore}
                        isDisabled={!onRestore}
                        className="text-gray-600 dark:text-gray-300"
                    >
                        <Icon icon="lucide:rotate-ccw" className="w-4 h-4" aria-hidden="true" />
                        {t('selection.restore')}
                    </Button>
                )}

                <Button
                    variant="danger"
                    size="sm"
                    onPress={onDelete}
                >
                    <Icon icon="lucide:trash-2" className="w-4 h-4" aria-hidden="true" />
                    {isTrash ? t('selection.deletePermanent') : t('selection.delete')}
                </Button>

                <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1" />

                {/* Close button */}
                <Button
                    isIconOnly
                    variant="tertiary"
                    size="sm"
                    onPress={onClear}
                    aria-label={t('aria.close')}
                    className="text-gray-400"
                >
                    <Icon icon="lucide:x" className="w-4 h-4" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
};
