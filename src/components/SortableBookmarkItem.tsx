/**
 * SortableBookmarkItem - dnd-kit sortable wrapper around BookmarkItem
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Node, ViewMode, CardFolderPreviewSize } from '../core/types';
import { cn } from '../core/utils';
import { BookmarkItem } from './BookmarkItem';

type ModifierKeys = {
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
};

function FolderDropTarget({ folderId }: { folderId: string }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `content-folder:${folderId}`,
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'pointer-events-none absolute rounded-xl transition-all',
                'inset-2',
                isOver
                    ? 'ring-2 ring-primary-500 bg-primary-500/5'
                    : 'ring-0 bg-transparent'
            )}
        />
    );
}

interface SortableBookmarkItemProps {
    node: Node;
    isSelected: boolean;
    viewMode: ViewMode;
    isRenaming: boolean;
    selectionMode: boolean;
    hasSelection: boolean;
    onPrimaryAction: (node: Node, keys: ModifierKeys) => void;
    onSelect: (id: string, keys: ModifierKeys, options?: { forceToggle?: boolean }) => void;
    onDoubleClick: (node: Node) => void;
    onContextMenu?: (node: Node, event: React.MouseEvent) => void;
    onRenameSubmit: (id: string, newTitle: string) => void;
    onRenameCancel: () => void;
    childCount?: number;
    childNodes?: Node[];
    cardFolderPreviewSize?: CardFolderPreviewSize;
}

export function SortableBookmarkItem({
    node,
    isSelected,
    viewMode,
    isRenaming,
    selectionMode,
    hasSelection,
    onPrimaryAction,
    onSelect,
    onDoubleClick,
    onContextMenu,
    onRenameSubmit,
    onRenameCancel,
    childCount = 0,
    childNodes = [],
    cardFolderPreviewSize = '2x2',
}: SortableBookmarkItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: node.id,
        disabled: isRenaming,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn('relative', isDragging && 'opacity-60')}
            data-node-id={node.id}
            {...attributes}
            {...listeners}
        >
            {node.type === 'folder' ? (
                <FolderDropTarget folderId={node.id} />
            ) : null}

            <BookmarkItem
                node={node}
                isSelected={isSelected}
                viewMode={viewMode}
                isRenaming={isRenaming}
                selectionMode={selectionMode}
                hasSelection={hasSelection}
                onPrimaryAction={(keys) => onPrimaryAction(node, keys)}
                onToggleSelect={() => onSelect(node.id, { shiftKey: false, metaKey: false, ctrlKey: false }, { forceToggle: true })}
                onDoubleClick={() => onDoubleClick(node)}
                onContextMenu={(e) => onContextMenu?.(node, e)}
                onRenameSubmit={(newTitle) => onRenameSubmit(node.id, newTitle)}
                onRenameCancel={onRenameCancel}
                childCount={childCount}
                childNodes={childNodes}
                cardFolderPreviewSize={cardFolderPreviewSize}
            />
        </div>
    );
}
