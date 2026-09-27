/**
 * ContextMenu 组件 - 右键上下文菜单
 *
 * 与文件管理器语义一致：
 * - 右键未选中的项 → 先选中该项，再对它操作
 * - 右键已选中的项 → 作用于整个选区（多选时批量删除等）
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Popover } from 'react-aria-components';
import { Menu } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import type { Node } from '../core/types';

export interface ContextMenuState {
    /** 指针位置 */
    x: number;
    y: number;
    /** 右键命中的节点 */
    nodeId: string;
    /** 本次操作实际作用到的节点（含多选展开后） */
    targetIds: string[];
}

interface ContextMenuProps {
    state: ContextMenuState | null;
    nodes: Record<string, Node>;
    onClose: () => void;
    onOpen: (node: Node) => void;
    onOpenInNewTab: (node: Node) => void;
    onRename: (node: Node) => void;
    onEdit: (node: Node) => void;
    onDelete: (ids: string[]) => void;
    onCopyUrl: (nodes: Node[]) => void;
    onMove: (node: Node) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
    state,
    nodes,
    onClose,
    onOpen,
    onOpenInNewTab,
    onRename,
    onEdit,
    onDelete,
    onCopyUrl,
    onMove,
}) => {
    const { t } = useTranslation();
    const anchorRef = useRef<HTMLSpanElement>(null);

    // 弹窗把指针位置当作"触发器"位置：
    // 在指针处放一个不可见的锚点，Popover 就会贴着它弹出
    const anchor = useMemo(() => {
        if (!state) return null;
        return (
            <span
                ref={anchorRef}
                className="context-menu-anchor"
                style={{
                    position: 'fixed',
                    left: state.x,
                    top: state.y,
                    width: 0,
                    height: 0,
                    pointerEvents: 'none',
                }}
            />
        );
    }, [state]);

    // 滚动或窗口尺寸变化时关闭，避免菜单脱离原位置
    useEffect(() => {
        if (!state) return;
        const close = () => onClose();
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [state, onClose]);

    if (!state || !anchor) return null;

    const node = nodes[state.nodeId];
    if (!node) return null;

    const isFolder = node.type === 'folder';
    const targets = state.targetIds
        .map(id => nodes[id])
        .filter((n): n is Node => Boolean(n));

    const run = (action: () => void) => () => {
        action();
        onClose();
    };

    return (
        <>
            {createPortal(anchor, document.body)}
            <Popover
                isOpen
                onOpenChange={(open) => {
                    if (!open) onClose();
                }}
                triggerRef={anchorRef}
                placement="bottom start"
                offset={0}
                className="popover context-menu-popover z-[100]"
                style={{ boxShadow: 'var(--shadow-overlay)' }}
            >
                <Menu
                    aria-label={t('contextMenu.edit')}
                    onAction={(key) => {
                        switch (key) {
                            case 'open':
                                run(() => onOpen(node))();
                                break;
                            case 'openInNewTab':
                                run(() => onOpenInNewTab(node))();
                                break;
                            case 'rename':
                                run(() => onRename(node))();
                                break;
                            case 'edit':
                                run(() => onEdit(node))();
                                break;
                            case 'moveTo':
                                run(() => onMove(node))();
                                break;
                            case 'copyUrl':
                                run(() => onCopyUrl(targets))();
                                break;
                            case 'delete':
                                run(() => onDelete(state.targetIds))();
                                break;
                        }
                    }}
                >
                    {isFolder ? (
                        <Menu.Item id="open" textValue={t('contextMenu.open')}>
                            <Icon icon="lucide:folder-open" className="w-4 h-4" aria-hidden="true" />
                            {t('contextMenu.open')}
                        </Menu.Item>
                    ) : (
                        <>
                            <Menu.Item id="openInNewTab" textValue={t('contextMenu.openInNewTab')}>
                                <Icon icon="lucide:external-link" className="w-4 h-4" aria-hidden="true" />
                                {t('contextMenu.openInNewTab')}
                            </Menu.Item>
                            <Menu.Item
                                id="copyUrl"
                                textValue={t('contextMenu.copyUrl')}
                                isDisabled={targets.length === 0}
                            >
                                <Icon icon="lucide:link" className="w-4 h-4" aria-hidden="true" />
                                {t('contextMenu.copyUrl')}
                            </Menu.Item>
                        </>
                    )}

                    <Menu.Item id="rename" textValue={t('contextMenu.rename')}>
                        <Icon icon="lucide:pencil" className="w-4 h-4" aria-hidden="true" />
                        {t('contextMenu.rename')}
                    </Menu.Item>

                    <Menu.Item id="edit" textValue={t('contextMenu.edit')}>
                        <Icon icon="lucide:sliders-horizontal" className="w-4 h-4" aria-hidden="true" />
                        {t('contextMenu.edit')}
                    </Menu.Item>

                    <Menu.Item id="moveTo" textValue={t('contextMenu.moveTo')}>
                        <Icon icon="lucide:folder-input" className="w-4 h-4" aria-hidden="true" />
                        {t('contextMenu.moveTo')}
                    </Menu.Item>

                    <Menu.Item id="delete" textValue={t('contextMenu.delete')} variant="danger">
                        <Icon icon="lucide:trash-2" className="w-4 h-4" aria-hidden="true" />
                        {t('contextMenu.delete')}
                    </Menu.Item>
                </Menu>
            </Popover>
        </>
    );
};
