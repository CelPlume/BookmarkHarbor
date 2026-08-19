/**
 * Toolbar 组件 - 工具栏（复刻参考设计）
 */

import React, { useCallback } from 'react';
import {
    Button,
    ButtonGroup,
    Dropdown,
    Header,
    Breadcrumbs,
    BreadcrumbsItem,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import type { SortField, SortOrder, ViewMode } from '../core/types';
import { cn } from '../core/utils';

interface BreadcrumbItemData {
    id: string;
    title: string;
}

interface ToolbarProps {
    breadcrumbs: BreadcrumbItemData[];
    onNavigate: (folderId: string) => void;
    onDelete: () => void;
    selectedCount: number;
    onSelectAll?: () => void;
    onClearSelection?: () => void;
    onInvertSelection?: () => void;
    selectionMode?: boolean;
    onToggleSelectionMode?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    sortField?: SortField;
    sortOrder?: SortOrder;
    onSortChange?: (field: SortField, order: SortOrder) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
    breadcrumbs,
    onNavigate,
    onDelete: _onDelete,
    selectedCount,
    onSelectAll,
    onClearSelection,
    onInvertSelection,
    selectionMode = false,
    onToggleSelectionMode,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    viewMode,
    onViewModeChange,
    sortField = 'default',
    sortOrder = 'asc',
    onSortChange,
}) => {
    const { t } = useTranslation();
    const maxBreadcrumbItems = 4;
    const itemsBeforeCollapse = 1;
    const itemsAfterCollapse = 2;
    const shouldCollapse = breadcrumbs.length > maxBreadcrumbItems;
    const collapsedItems = shouldCollapse
        ? breadcrumbs.slice(itemsBeforeCollapse, breadcrumbs.length - itemsAfterCollapse)
        : [];
    const visibleStart = shouldCollapse ? breadcrumbs.slice(0, itemsBeforeCollapse) : breadcrumbs;
    const visibleEnd = shouldCollapse ? breadcrumbs.slice(-itemsAfterCollapse) : [];

    const handleSortFieldChange = useCallback((field: SortField) => {
        onSortChange?.(field, sortOrder);
    }, [onSortChange, sortOrder]);

    const handleSortOrderChange = useCallback((order: SortOrder) => {
        onSortChange?.(sortField, order);
    }, [onSortChange, sortField]);

    return (
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            {/* Left button group */}
            <div className="flex min-w-0">
                <Breadcrumbs>
                    {visibleStart.map((crumb, index) => (
                        <BreadcrumbsItem
                            key={crumb.id}
                            onPress={() => onNavigate(crumb.id)}
                            aria-current={crumb.id === breadcrumbs[breadcrumbs.length - 1]?.id ? 'page' : undefined}
                        >
                            {index === 0 ? t('app.allBookmarks') : crumb.title}
                        </BreadcrumbsItem>
                    ))}

                    {shouldCollapse && (
                        <BreadcrumbsItem>
                            <Dropdown>
                                <Dropdown.Trigger>
                                    <Button
                                        isIconOnly
                                        variant="tertiary"
                                        size="sm"
                                        aria-label={t('aria.breadcrumbOverflow')}
                                    >
                                        <Icon icon="lucide:more-horizontal" className="w-4 h-4" aria-hidden="true" />
                                    </Button>
                                </Dropdown.Trigger>
                                <Dropdown.Popover>
                                    <Dropdown.Menu
                                        aria-label={t('aria.breadcrumbOverflow')}
                                        onAction={(key) => onNavigate(String(key))}
                                    >
                                        {collapsedItems.slice().reverse().map((crumb) => (
                                            <Dropdown.Item key={crumb.id} id={crumb.id}>
                                                {crumb.title}
                                            </Dropdown.Item>
                                        ))}
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown>
                        </BreadcrumbsItem>
                    )}

                    {visibleEnd.map((crumb) => (
                        <BreadcrumbsItem
                            key={crumb.id}
                            onPress={() => onNavigate(crumb.id)}
                            aria-current={crumb.id === breadcrumbs[breadcrumbs.length - 1]?.id ? 'page' : undefined}
                        >
                            {crumb.title}
                        </BreadcrumbsItem>
                    ))}
                </Breadcrumbs>
            </div>

            {/* Right button group */}
            <div className="flex gap-1 items-center">
                {/* Selection menu */}
                <Dropdown>
                    <Dropdown.Trigger>
                        <Button
                            isIconOnly
                            variant="tertiary"
                            size="sm"
                            aria-label={t('toolbar.selection')}
                        >
                            <Icon icon="lucide:check-square" className="w-4 h-4" aria-hidden="true" />
                        </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover>
                        <Dropdown.Menu
                            aria-label="Selection options"
                            onAction={(key) => {
                                switch (key) {
                                    case 'selectionMode':
                                        onToggleSelectionMode?.();
                                        break;
                                    case 'selectAll':
                                        onSelectAll?.();
                                        break;
                                    case 'clearSelection':
                                        onClearSelection?.();
                                        break;
                                    case 'invertSelection':
                                        onInvertSelection?.();
                                        break;
                                    case 'undo':
                                        onUndo?.();
                                        break;
                                    case 'redo':
                                        onRedo?.();
                                        break;
                                }
                            }}
                        >
                            <Dropdown.Item id="selectionMode">
                                <Icon icon="lucide:mouse-pointer-2" className="w-4 h-4" />
                                <span>{t('toolbar.selectionMode')}</span>
                                {selectionMode ? <Icon icon="lucide:check" className="ml-auto w-4 h-4" /> : null}
                            </Dropdown.Item>
                            <Dropdown.Item id="selectAll">
                                <Icon icon="lucide:check-check" className="w-4 h-4" />
                                <span>{t('toolbar.selectAll')}</span>
                            </Dropdown.Item>
                            <Dropdown.Item id="clearSelection" isDisabled={selectedCount === 0}>
                                <Icon icon="lucide:x" className="w-4 h-4" />
                                <span>{t('toolbar.clearSelection')}</span>
                            </Dropdown.Item>
                            <Dropdown.Item id="invertSelection">
                                <Icon icon="lucide:flip-vertical" className="w-4 h-4" />
                                <span>{t('toolbar.invertSelection')}</span>
                            </Dropdown.Item>
                            <Dropdown.Item id="undo" isDisabled={!canUndo}>
                                <Icon icon="lucide:undo" className="w-4 h-4" />
                                <span>{t('toolbar.undo')}</span>
                                <span className="ml-auto text-xs text-gray-400">⌘Z</span>
                            </Dropdown.Item>
                            <Dropdown.Item id="redo" isDisabled={!canRedo}>
                                <Icon icon="lucide:redo" className="w-4 h-4" />
                                <span>{t('toolbar.redo')}</span>
                                <span className="ml-auto text-xs text-gray-400">⌘⇧Z</span>
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>

                {/* Sort menu */}
                <Dropdown>
                    <Dropdown.Trigger>
                        <Button
                            isIconOnly
                            variant="tertiary"
                            size="sm"
                            aria-label={t('toolbar.sort')}
                        >
                            <Icon icon="lucide:arrow-up-down" className="w-4 h-4" aria-hidden="true" />
                        </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover>
                        <Dropdown.Menu
                            aria-label="Sort options"
                            onAction={(key) => {
                                switch (key) {
                                    case 'default':
                                    case 'title':
                                    case 'updatedAt':
                                    case 'type':
                                        handleSortFieldChange(key as SortField);
                                        break;
                                    case 'asc':
                                    case 'desc':
                                        handleSortOrderChange(key as SortOrder);
                                        break;
                                }
                            }}
                        >
                            <Dropdown.Section>
                                <Header>{t('toolbar.sortBy')}</Header>
                                <Dropdown.Item
                                    id="default"
                                    className={sortField === 'default' ? 'text-primary' : ''}
                                >
                                    <Icon icon="lucide:align-left" className="w-4 h-4" />
                                    <span>{t('toolbar.sortDefault')}</span>
                                </Dropdown.Item>
                                <Dropdown.Item
                                    id="title"
                                    className={sortField === 'title' ? 'text-primary' : ''}
                                >
                                    <Icon icon="lucide:type" className="w-4 h-4" />
                                    <span>{t('toolbar.sortByName')}</span>
                                </Dropdown.Item>
                                <Dropdown.Item
                                    id="updatedAt"
                                    className={sortField === 'updatedAt' ? 'text-primary' : ''}
                                >
                                    <Icon icon="lucide:calendar" className="w-4 h-4" />
                                    <span>{t('toolbar.sortByDate')}</span>
                                </Dropdown.Item>
                                <Dropdown.Item
                                    id="type"
                                    className={sortField === 'type' ? 'text-primary' : ''}
                                >
                                    <Icon icon="lucide:folder" className="w-4 h-4" />
                                    <span>{t('toolbar.sortByType')}</span>
                                </Dropdown.Item>
                            </Dropdown.Section>
                            <Dropdown.Section className="border-t border-gray-200/80 dark:border-white/10 pt-1">
                                <Header>{t('toolbar.order')}</Header>
                                <Dropdown.Item
                                    id="asc"
                                    isDisabled={sortField === 'default'}
                                    className={sortOrder === 'asc' ? 'text-primary' : ''}
                                >
                                    <Icon icon="lucide:arrow-up" className="w-4 h-4" />
                                    <span>{t('toolbar.ascending')}</span>
                                </Dropdown.Item>
                                <Dropdown.Item
                                    id="desc"
                                    isDisabled={sortField === 'default'}
                                    className={sortOrder === 'desc' ? 'text-primary' : ''}
                                >
                                    <Icon icon="lucide:arrow-down" className="w-4 h-4" />
                                    <span>{t('toolbar.descending')}</span>
                                </Dropdown.Item>
                            </Dropdown.Section>
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>

                <div className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />

                {/* 视图切换 */}
                <ButtonGroup size="sm" className="hidden sm:inline-flex">
                    <Button
                        isIconOnly
                        variant="tertiary"
                        onPress={() => onViewModeChange('list')}
                        aria-label={t('aria.listView')}
                        className={cn(
                            'transition-colors',
                            viewMode === 'list'
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'text-gray-600 dark:text-gray-400'
                        )}
                    >
                        <Icon icon="lucide:list" className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                        isIconOnly
                        variant="tertiary"
                        onPress={() => onViewModeChange('card')}
                        aria-label={t('aria.cardView')}
                        className={cn(
                            'transition-colors',
                            viewMode === 'card'
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'text-gray-600 dark:text-gray-400'
                        )}
                    >
                        <Icon icon="lucide:grid-2x2" className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                        isIconOnly
                        variant="tertiary"
                        onPress={() => onViewModeChange('tile')}
                        aria-label={t('aria.tileView')}
                        className={cn(
                            'transition-colors',
                            viewMode === 'tile'
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'text-gray-600 dark:text-gray-400'
                        )}
                    >
                        <Icon icon="lucide:layout-grid" className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </ButtonGroup>

                <div className="sm:hidden">
                    <Dropdown>
                        <Dropdown.Trigger>
                            <Button isIconOnly variant="tertiary" size="sm" aria-label={t('toolbar.view')}>
                                <Icon
                                    icon={viewMode === 'list' ? 'lucide:list' : viewMode === 'tile' ? 'lucide:layout-grid' : 'lucide:grid-2x2'}
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                            </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label={t('toolbar.view')}
                                onAction={(key) => onViewModeChange(key as ViewMode)}
                            >
                                <Dropdown.Item id="list">
                                    <Icon icon="lucide:list" className="w-4 h-4" />
                                    <span>{t('viewMode.list')}</span>
                                    {viewMode === 'list' ? <Icon icon="lucide:check" className="ml-auto w-4 h-4" /> : null}
                                </Dropdown.Item>
                                <Dropdown.Item id="card">
                                    <Icon icon="lucide:grid-2x2" className="w-4 h-4" />
                                    <span>{t('viewMode.card')}</span>
                                    {viewMode === 'card' ? <Icon icon="lucide:check" className="ml-auto w-4 h-4" /> : null}
                                </Dropdown.Item>
                                <Dropdown.Item id="tile">
                                    <Icon icon="lucide:layout-grid" className="w-4 h-4" />
                                    <span>{t('viewMode.tile')}</span>
                                    {viewMode === 'tile' ? <Icon icon="lucide:check" className="ml-auto w-4 h-4" /> : null}
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
            </div>
        </div>
    );
};
