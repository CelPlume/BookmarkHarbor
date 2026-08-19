/**
 * PanelResizer 组件 - 面板宽度拖拽手柄（无极调节）
 */

import React, { useCallback, useRef } from 'react';
import { cn } from '../core/utils';

interface PanelResizerProps {
    onResize: (clientX: number) => void;
    ariaLabel: string;
    className?: string;
}

export const PanelResizer: React.FC<PanelResizerProps> = ({ onResize, ariaLabel, className }) => {
    const activeRef = useRef(false);

    const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        activeRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
    }, []);

    const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!activeRef.current) return;
        onResize(event.clientX);
    }, [onResize]);

    const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        activeRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }, []);

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label={ariaLabel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={cn(
                'hidden sm:block relative z-30 w-2 flex-shrink-0 cursor-col-resize touch-none select-none',
                'group/rz flex items-center justify-center',
                className
            )}
        >
            <div className="h-full w-px bg-gray-200 dark:bg-white/10 transition-colors group-hover/rz:bg-[rgb(var(--color-primary-400-rgb))] group-active/rz:bg-[rgb(var(--color-primary-500-rgb))]" />
        </div>
    );
};
