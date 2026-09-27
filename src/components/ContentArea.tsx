/**
 * ContentArea 组件 - 主内容区域（复刻参考设计：分离 SUBFOLDERS 和 BOOKMARKS）
 */

import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { LayoutGroup, motion } from 'framer-motion';
import type { Node, ViewMode, CardFolderPreviewSize, SingleClickAction } from '../core/types';
import { BookmarkItem } from './BookmarkItem';
import { SortableBookmarkItem } from './SortableBookmarkItem';
import { cn } from '../core/utils';

type ModifierKeys = {
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
};

interface ContentAreaProps {
    nodes: Node[];
    allNodes: Record<string, Node>;
    folderId: string;
    viewMode: ViewMode;
    isDragging: boolean;
    isSortable: boolean;
    selectionMode: boolean;
    selectedIds: Set<string>;
    renamingId: string | null;
    searchQuery: string;
    cardFolderPreviewSize: CardFolderPreviewSize;
    cardColumnsDesktop: number;
    cardColumnsMobile: number;
    tileColumnsDesktop: number;
    tileColumnsMobile: number;
    onCardColumnsDesktopChange: (value: number) => void;
    onCardColumnsMobileChange: (value: number) => void;
    onTileColumnsDesktopChange: (value: number) => void;
    onTileColumnsMobileChange: (value: number) => void;
    onPrimaryAction: (node: Node, keys: ModifierKeys) => void;
    singleClickAction: SingleClickAction;
    onSelect: (id: string, keys: ModifierKeys, options?: { forceToggle?: boolean }) => void;
    onDoubleClick: (node: Node) => void;
    onContextMenu?: (node: Node, event: React.MouseEvent) => void;
    onClearSelection: () => void;
    onRenameSubmit: (id: string, newTitle: string) => void;
    onRenameCancel: () => void;
}

export const ContentArea: React.FC<ContentAreaProps> = ({
    nodes,
    allNodes,
    folderId,
    viewMode,
    isDragging,
    isSortable,
    selectionMode,
    selectedIds,
    renamingId,
    searchQuery,
    cardFolderPreviewSize,
    cardColumnsDesktop,
    cardColumnsMobile,
    tileColumnsDesktop,
    tileColumnsMobile,
    onCardColumnsDesktopChange,
    onCardColumnsMobileChange,
    onTileColumnsDesktopChange,
    onTileColumnsMobileChange,
    onPrimaryAction,
    singleClickAction,
    onSelect,
    onDoubleClick,
    onContextMenu,
    onClearSelection,
    onRenameSubmit,
    onRenameCancel,
}) => {
    const { t } = useTranslation();
    const hasSelection = selectedIds.size > 0;
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [contentWidth, setContentWidth] = useState(0);

    const { setNodeRef } = useDroppable({
        id: `content:${folderId}`,
    });

    const setContentRefs = useCallback(
        (node: HTMLDivElement | null) => {
            contentRef.current = node;
            setNodeRef(node);
        },
        [setNodeRef]
    );

    useEffect(() => {
        if (!contentRef.current || typeof ResizeObserver === 'undefined') return;
        const node = contentRef.current;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect) {
                    setContentWidth(entry.contentRect.width);
                }
            }
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const sortingStrategy = useMemo(() => {
        return viewMode === 'list' ? verticalListSortingStrategy : rectSortingStrategy;
    }, [viewMode]);

    // Helper to get child nodes for a folder
    const getChildNodes = (parentId: string) => {
        return Object.values(allNodes)
            .filter(n => n.parentId === parentId && !n.deletedAt)
            .sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    };

    // Helper to get child count for a folder
    const getChildCount = (parentId: string) => {
        return Object.values(allNodes).filter(n => n.parentId === parentId && !n.deletedAt).length;
    };

    // Separate folders and bookmarks
    const folders = useMemo(() => nodes.filter(n => n.type === 'folder'), [nodes]);
    const bookmarks = useMemo(() => nodes.filter(n => n.type === 'bookmark'), [nodes]);
    const renderedNodes = useMemo(() => [...folders, ...bookmarks], [folders, bookmarks]);

    const enableLayoutAnimation = viewMode !== 'list' && !isDragging;
    const layoutTransition = { layout: { duration: 0.18, ease: 'easeOut' } } as const;

    const allowDoubleClick = singleClickAction !== 'open';
    const isCompact = useMemo(() => {
        if (contentWidth > 0) return contentWidth < 640;
        if (typeof window === 'undefined') return false;
        return window.innerWidth < 640;
    }, [contentWidth]);

    const gridConfig = useMemo(() => {
        if (viewMode === 'tile') {
            return isCompact
                ? {
                    value: tileColumnsMobile,
                    min: 1,
                    max: 2,
                    onChange: onTileColumnsMobileChange,
                }
                : {
                    value: tileColumnsDesktop,
                    min: 1,
                    max: 7,
                    onChange: onTileColumnsDesktopChange,
                };
        }
        if (viewMode === 'card') {
            return isCompact
                ? {
                    value: cardColumnsMobile,
                    min: 1,
                    max: 4,
                    onChange: onCardColumnsMobileChange,
                }
                : {
                    value: cardColumnsDesktop,
                    min: 2,
                    max: 9,
                    onChange: onCardColumnsDesktopChange,
                };
        }
        return { value: 1, min: 1, max: 1, onChange: () => {} };
    }, [
        cardColumnsDesktop,
        cardColumnsMobile,
        isCompact,
        onCardColumnsDesktopChange,
        onCardColumnsMobileChange,
        onTileColumnsDesktopChange,
        onTileColumnsMobileChange,
        tileColumnsDesktop,
        tileColumnsMobile,
        viewMode,
    ]);

    const clampColumns = useCallback((value: number) => {
        return Math.min(gridConfig.max, Math.max(gridConfig.min, Math.round(value)));
    }, [gridConfig.max, gridConfig.min]);

    const handleGridStep = useCallback(
        (delta: number) => {
            if (viewMode === 'list') return;
            const next = clampColumns(gridConfig.value + delta);
            if (next !== gridConfig.value) {
                gridConfig.onChange(next);
            }
        },
        [clampColumns, gridConfig, viewMode]
    );

    const handleWheel = useCallback(
        (event: React.WheelEvent<HTMLDivElement>) => {
            if (viewMode === 'list') return;
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            const delta = event.deltaY;
            if (Math.abs(delta) < 4) return;
            handleGridStep(delta > 0 ? 1 : -1);
        },
        [handleGridStep, viewMode]
    );

    const pinchRef = useRef<{ distance: number } | null>(null);

    const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        if (viewMode === 'list') return;
        if (event.touches.length === 2) {
            const a = event.touches.item(0);
            const b = event.touches.item(1);
            if (!a || !b) return;
            const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            pinchRef.current = { distance };
        }
    }, [viewMode]);

    const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        if (viewMode === 'list') return;
        if (event.touches.length !== 2 || !pinchRef.current) return;
        const a = event.touches.item(0);
        const b = event.touches.item(1);
        if (!a || !b) return;
        event.preventDefault();
        const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const diff = distance - pinchRef.current.distance;
        if (Math.abs(diff) > 24) {
            handleGridStep(diff > 0 ? -1 : 1);
            pinchRef.current = { distance };
        }
    }, [handleGridStep, viewMode]);

    const handleTouchEnd = useCallback(() => {
        pinchRef.current = null;
    }, []);

    const effectiveColumns = useMemo(() => {
        if (viewMode === 'list') return 1;
        const baseColumns = clampColumns(gridConfig.value);
        if (!contentWidth) return baseColumns;
        const minWidth = viewMode === 'tile' ? 160 : 220;
        const gap = viewMode === 'tile' ? 8 : 12;
        const maxByWidth = Math.max(gridConfig.min, Math.floor((contentWidth + gap) / (minWidth + gap)));
        return Math.min(baseColumns, maxByWidth);
    }, [clampColumns, contentWidth, gridConfig.min, gridConfig.value, viewMode]);
    const gridStyle = viewMode === 'list'
        ? undefined
        : { gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))` };

    // Get grid class based on view mode
    const getGridClass = (forFolders = false) => {
        if (viewMode === 'list') {
            return 'flex flex-col gap-1';
        }
        if (viewMode === 'tile') {
            return 'grid gap-2 transition-[grid-template-columns] duration-200';
        }
        // card view
        if (forFolders) {
            return 'grid gap-3 transition-[grid-template-columns] duration-200';
        }
        return 'grid gap-3 transition-[grid-template-columns] duration-200';
    };

    const renderNode = (node: Node, isReadOnly: boolean) => {
        if (isReadOnly) {
            return (
                <BookmarkItem
                    key={node.id}
                    node={node}
                    isSelected={selectedIds.has(node.id)}
                    viewMode={viewMode}
                    isRenaming={renamingId === node.id}
                    selectionMode={selectionMode}
                    hasSelection={hasSelection}
                    onPrimaryAction={(keys) => onPrimaryAction(node, keys)}
                    onToggleSelect={() => onSelect(node.id, { shiftKey: false, metaKey: false, ctrlKey: false }, { forceToggle: true })}
                    onDoubleClick={() => {
                        if (allowDoubleClick) onDoubleClick(node);
                    }}
                    onContextMenu={(e) => onContextMenu?.(node, e)}
                    onRenameSubmit={(newTitle) => onRenameSubmit(node.id, newTitle)}
                    onRenameCancel={onRenameCancel}
                    childCount={node.type === 'folder' ? getChildCount(node.id) : 0}
                    childNodes={node.type === 'folder' ? getChildNodes(node.id) : []}
                    cardFolderPreviewSize={cardFolderPreviewSize}
                />
            );
        }

        return (
            <SortableBookmarkItem
                key={node.id}
                node={node}
                isSelected={selectedIds.has(node.id)}
                viewMode={viewMode}
                isRenaming={renamingId === node.id}
                selectionMode={selectionMode}
                hasSelection={hasSelection}
                onPrimaryAction={onPrimaryAction}
                onSelect={onSelect}
                onDoubleClick={(nextNode) => {
                    if (allowDoubleClick) onDoubleClick(nextNode);
                }}
                onContextMenu={(nextNode, e) => onContextMenu?.(nextNode, e)}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                childCount={node.type === 'folder' ? getChildCount(node.id) : 0}
                childNodes={node.type === 'folder' ? getChildNodes(node.id) : []}
                cardFolderPreviewSize={cardFolderPreviewSize}
            />
        );
    };

    // Empty state
    if (nodes.length === 0) {
        return (
            <div
                className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6"
                onPointerDown={(e) => {
                    if (e.target === e.currentTarget) onClearSelection();
                }}
            >
                {searchQuery ? (
                    <>
                        <Icon icon="lucide:search-x" className="w-20 h-20 mb-4 stroke-[0.5]" aria-hidden="true" />
                        <p className="text-lg font-medium text-gray-500 dark:text-gray-400">{t('search.noResults')}</p>
                        <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">{t('empty.description')}</p>
                    </>
                ) : (
                    <>
                        <Icon icon="lucide:folder-open" className="w-20 h-20 mb-4 stroke-[0.5]" aria-hidden="true" />
                        <p className="text-lg font-medium text-gray-500 dark:text-gray-400">{t('empty.title')}</p>
                        <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">{t('empty.description')}</p>
                    </>
                )}
            </div>
        );
    }

    // When searching, show all results together
    if (searchQuery) {
        return (
            <div
                ref={setContentRefs}
                className="flex-1 overflow-y-auto p-5"
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onPointerDown={(e) => {
                    if (e.target === e.currentTarget) onClearSelection();
                }}
            >
                <SortableContext items={renderedNodes.map((n) => n.id)} strategy={sortingStrategy}>
                    {enableLayoutAnimation ? (
                        <LayoutGroup id={`content-search:${folderId}:${viewMode}`}>
                            <motion.div
                                layout
                                transition={layoutTransition}
                                className={cn(getGridClass())}
                                style={gridStyle}
                                onPointerDown={(e) => {
                                    if (e.target === e.currentTarget) onClearSelection();
                                }}
                            >
                                {renderedNodes.map((node) => (
                                    <motion.div key={node.id} layout="position" transition={layoutTransition}>
                                        {renderNode(node, true)}
                                    </motion.div>
                                ))}
                            </motion.div>
                        </LayoutGroup>
                    ) : (
                        <div
                            className={cn(getGridClass())}
                            style={gridStyle}
                            onPointerDown={(e) => {
                                if (e.target === e.currentTarget) onClearSelection();
                            }}
                        >
                            {renderedNodes.map((node) => renderNode(node, true))}
                        </div>
                    )}
                </SortableContext>
            </div>
        );
    }

    return (
        <motion.div
            key={folderId}
            ref={setContentRefs}
            className="flex-1 overflow-y-auto px-5 py-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onPointerDown={(e) => {
                if (e.target === e.currentTarget) onClearSelection();
            }}
        >
            <SortableContext items={renderedNodes.map((n) => n.id)} strategy={sortingStrategy}>
                {enableLayoutAnimation ? (
                    <LayoutGroup id={`content:${folderId}:${viewMode}`}>
                        <motion.div
                            layout
                            transition={layoutTransition}
                            className={cn(getGridClass())}
                            style={gridStyle}
                            onPointerDown={(e) => {
                                if (e.target === e.currentTarget) onClearSelection();
                            }}
                        >
                            {/* SUBFOLDERS Section */}
                            {folders.length > 0 && (
                                <motion.h2
                                    layout="position"
                                    transition={layoutTransition}
                                    className="col-span-full text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1"
                                >
                                    {t('content.subfolders')}
                                </motion.h2>
                            )}
                            {folders.map((node) => (
                                <motion.div key={node.id} layout="position" transition={layoutTransition}>
                                    {renderNode(node, !isSortable)}
                                </motion.div>
                            ))}

                            {/* BOOKMARKS Section */}
                            {bookmarks.length > 0 && (
                                <motion.h2
                                    layout="position"
                                    transition={layoutTransition}
                                    className={cn(
                                        'col-span-full text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1',
                                        folders.length > 0 && 'mt-2'
                                    )}
                                >
                                    {t('content.bookmarks')}
                                </motion.h2>
                            )}
                            {bookmarks.map((node) => (
                                <motion.div key={node.id} layout="position" transition={layoutTransition}>
                                    {renderNode(node, !isSortable)}
                                </motion.div>
                            ))}
                        </motion.div>
                    </LayoutGroup>
                ) : (
                    <div
                        className={cn(getGridClass())}
                        style={gridStyle}
                        onPointerDown={(e) => {
                            if (e.target === e.currentTarget) onClearSelection();
                        }}
                    >
                        {/* SUBFOLDERS Section */}
                        {folders.length > 0 && viewMode !== 'list' && (
                            <h2 className="col-span-full text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
                                {t('content.subfolders')}
                            </h2>
                        )}
                        {folders.map((node) => renderNode(node, !isSortable))}

                        {/* BOOKMARKS Section */}
                        {bookmarks.length > 0 && viewMode !== 'list' && (
                            <h2 className={cn('col-span-full text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1', folders.length > 0 && 'mt-2')}>
                                {t('content.bookmarks')}
                            </h2>
                        )}
                        {bookmarks.map((node) => renderNode(node, !isSortable))}
                    </div>
                )}
            </SortableContext>
        </motion.div>
    );
};
