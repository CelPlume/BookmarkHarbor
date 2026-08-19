/**
 * BookmarkItem 组件 - 书签/文件夹卡片（复刻参考设计）
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import type { Node } from '../core/types';
import { cn, formatDate, extractDomain } from '../core/utils';
import { createRenameKeyHandler } from '../core/hooks/useKeyboard';

type ModifierKeys = {
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
};

interface BookmarkItemProps {
    node: Node;
    isSelected: boolean;
    viewMode: 'list' | 'card' | 'tile';
    isRenaming: boolean;
    selectionMode: boolean;
    hasSelection: boolean;
    onPrimaryAction: (keys: ModifierKeys) => void;
    onToggleSelect: () => void;
    onDoubleClick: () => void;
    onRenameSubmit: (newTitle: string) => void;
    onRenameCancel: () => void;
    childCount?: number;
    childNodes?: Node[];
    cardFolderPreviewSize?: '2x2' | '3x3' | '4x3';
}

const FOLDER_COLORS = ['#f97316', '#a855f7', '#22c55e', '#3b82f6', '#ec4899', '#14b8a6'];

const getFolderColor = (id: string, customColor?: string): string => {
    if (customColor) return customColor;
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return FOLDER_COLORS[hash % FOLDER_COLORS.length];
};

export const BookmarkItem: React.FC<BookmarkItemProps> = ({
    node,
    isSelected,
    viewMode,
    isRenaming,
    selectionMode,
    hasSelection,
    onPrimaryAction,
    onToggleSelect,
    onDoubleClick,
    onRenameSubmit,
    onRenameCancel,
    childCount = 0,
    childNodes = [],
    cardFolderPreviewSize = '2x2',
}) => {
    const { t } = useTranslation();
    const [renameValue, setRenameValue] = useState(node.title);
    const [isHovered, setIsHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const ignoreBlurRef = useRef(false);
    const lastTapRef = useRef(0);

    useEffect(() => {
        if (isRenaming && inputRef.current) {
            setRenameValue(node.title);
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isRenaming, node.title]);

    const handleRenameKeyDown = createRenameKeyHandler({
        onSubmit: () => {
            ignoreBlurRef.current = true;
            onRenameSubmit(renameValue);
        },
        onCancel: () => {
            ignoreBlurRef.current = true;
            onRenameCancel();
        },
    });

    const isFolder = node.type === 'folder';
    const folderColor = getFolderColor(node.id, node.color);
    const markerColor = node.color || (isFolder ? folderColor : '#6366f1');
    const showSelectionToggle = !isRenaming && (selectionMode || isSelected || (hasSelection && isHovered));
    const doubleTapWindow = 300;

    const handleTouchDoubleTap = (event: React.PointerEvent) => {
        if (event.pointerType !== 'touch') return false;
        const now = Date.now();
        const lastTap = lastTapRef.current;
        lastTapRef.current = now;
        if (lastTap && now - lastTap < doubleTapWindow) {
            lastTapRef.current = 0;
            onDoubleClick();
            return true;
        }
        return false;
    };

    const renderSelectionToggle = (className?: string) => {
        return (
            <button
                type="button"
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleSelect();
                }}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                aria-pressed={isSelected}
                aria-hidden={!showSelectionToggle}
                tabIndex={showSelectionToggle ? 0 : -1}
                disabled={!showSelectionToggle}
                className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center border transition-colors',
                    isSelected
                        ? 'bg-[rgb(var(--color-primary-500-rgb))] border-[rgb(var(--color-primary-500-rgb))] text-white shadow-sm'
                        : 'bg-white/80 dark:bg-gray-800/80 border-gray-300 dark:border-gray-600 text-transparent hover:border-[rgb(var(--color-primary-500-rgb))]',
                    showSelectionToggle ? 'opacity-100' : 'opacity-0 pointer-events-none',
                    className
                )}
            >
                <Icon icon="lucide:check" className={cn('w-3 h-3', isSelected ? 'text-white' : 'text-transparent')} aria-hidden="true" />
            </button>
        );
    };

    // Helper to get preview grid dimensions
    const getPreviewGrid = () => {
        switch (cardFolderPreviewSize) {
            case '2x2': return { cols: 2, rows: 2 };
            case '3x3': return { cols: 3, rows: 3 };
            case '4x3': return { cols: 4, rows: 3 };
            default: return { cols: 2, rows: 2 };
        }
    };

    // Tile view - folder style for both folders and bookmarks
    if (viewMode === 'tile') {
        return (
            <Card
                onPointerEnter={() => setIsHovered(true)}
                onPointerLeave={() => setIsHovered(false)}
                onPointerDown={(e) => {
                    if (isRenaming) return;
                    if (e.button !== 0) return;
                    if (handleTouchDoubleTap(e)) return;
                    onPrimaryAction({
                        shiftKey: e.shiftKey,
                        metaKey: e.metaKey,
                        ctrlKey: e.ctrlKey,
                    });
                }}
                onDoubleClick={onDoubleClick}
                className={cn(
                    'h-16 w-full p-0 transition-all transition-transform border border-gray-200/50 dark:border-white/5',
                    'bg-white/80 dark:bg-gray-800/50 backdrop-blur-md',
                    isSelected && 'ring-2 ring-[rgb(var(--color-primary-500-rgb))] bg-[rgb(var(--color-primary-100-rgb)_/_0.8)] dark:bg-[rgb(var(--color-primary-900-rgb)_/_0.35)]'
                )}
            >
                <Card.Content className="flex flex-row items-center gap-3 p-3">
                    {/* Icon */}
                    <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${node.color || folderColor}20` }}
                    >
                        {isFolder ? (
                            <Icon
                                icon="lucide:folder"
                                className="w-5 h-5"
                                style={{ color: folderColor }}
                                aria-hidden="true"
                            />
                        ) : node.iconUrl ? (
                            <img
                                src={node.iconUrl}
                                alt=""
                                width={20}
                                height={20}
                                loading="lazy"
                                decoding="async"
                                className="w-5 h-5 object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <Icon
                                icon="lucide:bookmark"
                                className="w-5 h-5"
                                style={{ color: node.color || '#6366f1' }}
                                aria-hidden="true"
                            />
                        )}
                    </div>

                    {/* Title and Info */}
                    <div className="flex-1 min-w-0">
                        {isRenaming ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={handleRenameKeyDown}
                                onBlur={() => {
                                    if (ignoreBlurRef.current) {
                                        ignoreBlurRef.current = false;
                                        return;
                                    }
                                    onRenameSubmit(renameValue);
                                }}
                                className="w-full text-sm font-medium bg-transparent border-none text-gray-900 dark:text-white outline-none"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <>
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {node.title}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                    {isFolder ? `${childCount} ${t('content.items')}` : extractDomain(node.url || '')}
                                </p>
                            </>
                        )}
                    </div>

                    {/* Tail indicator */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: markerColor }}
                            aria-hidden="true"
                        />
                        {renderSelectionToggle()}
                    </div>
                </Card.Content>
            </Card>
        );
    }

    // Card view - folder with preview grid
    if (viewMode === 'card' && isFolder) {
        const { cols, rows } = getPreviewGrid();
        const maxItems = cols * rows;
        const previewItems = childNodes.slice(0, maxItems);

        return (
            <Card
                onPointerEnter={() => setIsHovered(true)}
                onPointerLeave={() => setIsHovered(false)}
                onPointerDown={(e) => {
                    if (isRenaming) return;
                    if (e.button !== 0) return;
                    if (handleTouchDoubleTap(e)) return;
                    onPrimaryAction({
                        shiftKey: e.shiftKey,
                        metaKey: e.metaKey,
                        ctrlKey: e.ctrlKey,
                    });
                }}
                onDoubleClick={onDoubleClick}
                className={cn(
                    'overflow-hidden w-full p-0 transition-all transition-transform border border-gray-200/50 dark:border-white/5',
                    'bg-white/80 dark:bg-gray-800/50 backdrop-blur-md',
                    isSelected && 'ring-2 ring-[rgb(var(--color-primary-500-rgb))] bg-[rgb(var(--color-primary-100-rgb)_/_0.8)] dark:bg-[rgb(var(--color-primary-900-rgb)_/_0.35)]'
                )}
            >
                {/* Folder preview grid or empty state */}
                <div className="aspect-square w-full bg-gray-50 dark:bg-gray-800/50 p-2">
                    {previewItems.length > 0 ? (
                        <div
                            className="w-full h-full grid gap-1"
                            style={{
                                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                gridTemplateRows: `repeat(${rows}, 1fr)`,
                            }}
                        >
                            {previewItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="rounded-lg overflow-hidden bg-white dark:bg-gray-700 flex items-center justify-center"
                                >
                                    {item.type === 'folder' ? (
                                        <Icon
                                            icon="lucide:folder"
                                            className="w-4 h-4"
                                            style={{ color: item.color || '#60a5fa' }}
                                        />
                                    ) : item.iconUrl ? (
                                        <img
                                            src={item.iconUrl}
                                            alt=""
                                            className="w-4 h-4 object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: item.color || '#6366f1' }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Icon
                                icon="lucide:folder"
                                className="w-12 h-12"
                                style={{ color: folderColor }}
                                aria-hidden="true"
                            />
                        </div>
                    )}
                </div>

                <Card.Content className="p-3">
                    {isRenaming ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={handleRenameKeyDown}
                            onBlur={() => {
                                if (ignoreBlurRef.current) {
                                    ignoreBlurRef.current = false;
                                    return;
                                }
                                onRenameSubmit(renameValue);
                            }}
                            className="w-full text-sm font-medium bg-transparent border-none text-gray-900 dark:text-white outline-none"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {node.title}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                {childCount} {t('content.items')}
                            </p>
                        </>
                    )}
                </Card.Content>

                {/* Selected indicator */}
                <div className="absolute top-2 left-2">
                    {renderSelectionToggle()}
                </div>
            </Card>
        );
    }

    // Card view - bookmark with thumbnail
    if (viewMode === 'card') {
        return (
            <Card
                onPointerEnter={() => setIsHovered(true)}
                onPointerLeave={() => setIsHovered(false)}
                onPointerDown={(e) => {
                    if (isRenaming) return;
                    if (e.button !== 0) return;
                    if (handleTouchDoubleTap(e)) return;
                    onPrimaryAction({
                        shiftKey: e.shiftKey,
                        metaKey: e.metaKey,
                        ctrlKey: e.ctrlKey,
                    });
                }}
                onDoubleClick={onDoubleClick}
                className={cn(
                    'overflow-hidden w-full p-0 transition-all transition-transform border border-gray-200/50 dark:border-white/5',
                    'bg-white/80 dark:bg-gray-800/50 backdrop-blur-md',
                    isSelected && 'ring-2 ring-[rgb(var(--color-primary-500-rgb))] bg-[rgb(var(--color-primary-50-rgb))] dark:bg-[rgb(var(--color-primary-900-rgb)_/_0.35)]'
                )}
            >
                <Card.Content className="p-0">
                    <div
                        className="aspect-[16/10] w-full bg-cover bg-center bg-no-repeat relative flex items-center justify-center"
                        style={{
                            background: node.coverUrl
                                ? `url(${node.coverUrl}) center/cover`
                                : `linear-gradient(135deg, ${markerColor}, ${markerColor}88)`,
                        }}
                    >
                        <div className="absolute top-2 left-2">
                            {renderSelectionToggle()}
                        </div>
                        <div className="absolute inset-0 bg-black/10" />
                        {node.iconUrl ? (
                            <img
                                src={node.iconUrl}
                                alt=""
                                width={56}
                                height={56}
                                loading="lazy"
                                decoding="async"
                                className="w-14 h-14 rounded-full object-contain relative z-10 bg-white/85 p-2 shadow-sm"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <Icon
                                icon="lucide:bookmark"
                                className="w-12 h-12 relative z-10"
                                style={{ color: 'white' }}
                                aria-hidden="true"
                            />
                        )}
                    </div>
                </Card.Content>

                <Card.Footer className="p-3 pt-2 flex flex-col items-start gap-0.5">
                    {isRenaming ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={handleRenameKeyDown}
                            onBlur={() => {
                                if (ignoreBlurRef.current) {
                                    ignoreBlurRef.current = false;
                                    return;
                                }
                                onRenameSubmit(renameValue);
                            }}
                            className="w-full text-sm font-medium bg-transparent border-none text-gray-900 dark:text-white outline-none"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <>
                            <div className="flex items-center gap-2 w-full">
                                <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: markerColor }}
                                    aria-hidden="true"
                                />
                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {node.title}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate w-full">
                                {extractDomain(node.url || '')}
                            </p>
                        </>
                    )}
                </Card.Footer>
            </Card>
        );
    }

    // 列表视图
    if (isRenaming) {
        return (
            <div
                className={cn(
                    'group flex items-center p-2 h-12 rounded-lg transition-all cursor-pointer',
                    isSelected
                        ? 'bg-[rgb(var(--color-primary-100-rgb))] dark:bg-[rgb(var(--color-primary-900-rgb)_/_0.25)] ring-1 ring-[rgb(var(--color-primary-500-rgb))]'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
            >
                {/* 图标 */}
                <div className="w-8 flex items-center justify-center flex-shrink-0">
                    {isFolder ? (
                        <Icon
                            icon="lucide:folder"
                            className="w-5 h-5"
                            style={{ color: node.color || '#3b82f6' }}
                            aria-hidden="true"
                        />
                    ) : (
                        <div
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `color-mix(in srgb, ${node.color || '#94a3b8'} 55%, #0f172a)` }}
                        >
                            {node.iconUrl ? (
                                <img
                                    src={node.iconUrl}
                                    alt=""
                                    width={16}
                                    height={16}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-4 h-4 object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : (
                                <span className="text-[10px] text-white/70 font-bold uppercase">
                                    {node.title.charAt(0)}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* 标题 */}
                <div className="flex-1 ml-3 min-w-0">
                    <input
                        ref={inputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={() => {
                            if (ignoreBlurRef.current) {
                                ignoreBlurRef.current = false;
                                return;
                            }
                            onRenameSubmit(renameValue);
                        }}
                        className="w-full text-sm font-medium bg-transparent border-none dark:text-white"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            onPointerDown={(e) => {
                if (e.button !== 0) return;
                if (handleTouchDoubleTap(e)) return;
                onPrimaryAction({
                    shiftKey: e.shiftKey,
                    metaKey: e.metaKey,
                    ctrlKey: e.ctrlKey,
                });
            }}
            onDoubleClick={onDoubleClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPrimaryAction({ shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey });
                }
            }}
            className={cn(
                'group flex items-center p-2 h-12 rounded-lg transition-all cursor-pointer w-full text-left',
                isSelected
                    ? 'bg-[rgb(var(--color-primary-100-rgb))] dark:bg-[rgb(var(--color-primary-900-rgb)_/_0.25)] ring-1 ring-[rgb(var(--color-primary-500-rgb))]'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
        >
            {/* 图标 */}
            <div className="w-8 flex items-center justify-center flex-shrink-0">
                {isFolder ? (
                    <Icon
                        icon="lucide:folder"
                        className="w-5 h-5"
                        style={{ color: node.color || '#3b82f6' }}
                        aria-hidden="true"
                    />
                ) : (
                    <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `color-mix(in srgb, ${node.color || '#94a3b8'} 55%, #0f172a)` }}
                    >
                        {node.iconUrl ? (
                            <img
                                src={node.iconUrl}
                                alt=""
                                width={16}
                                height={16}
                                className="w-4 h-4 object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <span className="text-[10px] text-white/70 font-bold uppercase">
                                {node.title.charAt(0)}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* 标题 */}
            <div className="flex-1 ml-3 min-w-0">
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate font-medium block">
                    {node.title}
                </span>
            </div>

            {/* URL / 子项数量 */}
            <span className="text-xs text-gray-400 hidden md:block w-32 truncate">
                {isFolder ? '' : extractDomain(node.url || '')}
            </span>

            {/* 创建时间 */}
            <span className="text-xs text-gray-400 hidden lg:block w-24 text-right">
                {formatDate(node.createdAt)}
            </span>

            {/* 选中指示器 */}
            <div className="w-6 flex items-center justify-center ml-2">
                {renderSelectionToggle()}
            </div>
        </div>
    );
};
