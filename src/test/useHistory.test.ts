/**
 * 撤销历史栈的 StrictMode 行为测试
 *
 * 背景：useHistory 的 undo() 在 setPast 的更新函数内部执行副作用
 * （调用 entry.undo()）并嵌套调用 setFuture。React 官方文档指出，
 * 更新函数必须是纯函数，在 StrictMode 下开发模式会被调用两次。
 *
 * 这个文件用 React 的真实 StrictMode 渲染来验证该推断是否成立：
 * 如果成立，一次 undo 会让副作用执行两次。
 */

import { describe, it, expect } from 'vitest';
import React, { StrictMode, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { useHistory, type UseHistoryReturn } from '../core/hooks/useHistory';

/** 把 hook 暴露到外部，便于在测试里调用 */
function Probe({ onReady }: { onReady: (h: UseHistoryReturn) => void }) {
    const history = useHistory({ limit: 10 });
    const ref = useRef(onReady);
    ref.current = onReady;
    ref.current(history);
    return null;
}

interface Harness {
    root: Root;
    container: HTMLElement;
    history: () => UseHistoryReturn;
    unmount: () => void;
}

/**
 * 在指定的包裹组件下挂载 hook
 *
 * strict=true 时用 React.StrictMode 包裹，模拟开发模式的双调用行为。
 */
async function mount(strict: boolean): Promise<Harness> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let captured: UseHistoryReturn | null = null;
    const tree = React.createElement(Probe, { onReady: (h) => { captured = h; } });

    await act(async () => {
        root.render(strict ? React.createElement(StrictMode, null, tree) : tree);
    });

    return {
        root,
        container,
        history: () => {
            if (!captured) throw new Error('hook 尚未就绪');
            return captured;
        },
        unmount: () => {
            act(() => root.unmount());
            container.remove();
        },
    };
}

describe('useHistory 在 StrictMode 下的行为', () => {
    it('非 StrictMode：一次 undo 只执行一次副作用', async () => {
        const h = await mount(false);
        try {
            let calls = 0;
            act(() => {
                h.history().record({ undo: () => { calls += 1; }, redo: () => {} });
            });
            act(() => h.history().undo());

            expect(calls).toBe(1);
        } finally {
            h.unmount();
        }
    });

    it('StrictMode：一次 undo 是否重复执行副作用', async () => {
        const h = await mount(true);
        try {
            let calls = 0;
            act(() => {
                h.history().record({ undo: () => { calls += 1; }, redo: () => {} });
            });
            act(() => h.history().undo());

            // 若该值大于 1，说明更新函数被调用了多次，副作用被重复执行
            expect(calls).toBe(1);
        } finally {
            h.unmount();
        }
    });

    it('StrictMode：撤销后 future 栈不应出现重复项', async () => {
        const h = await mount(true);
        try {
            act(() => {
                h.history().record({ undo: () => {}, redo: () => {} });
            });
            act(() => h.history().undo());

            expect(h.history().canUndo).toBe(false);
            expect(h.history().canRedo).toBe(true);

            // 重做一次后 future 应为空；若有重复项，canRedo 仍为 true
            act(() => h.history().redo());
            expect(h.history().canRedo).toBe(false);
        } finally {
            h.unmount();
        }
    });

    it('StrictMode：连续 undo/redo 后栈长度保持正确', async () => {
        const h = await mount(true);
        try {
            act(() => {
                h.history().record({ undo: () => {}, redo: () => {} });
                h.history().record({ undo: () => {}, redo: () => {} });
            });

            act(() => h.history().undo());
            act(() => h.history().redo());

            expect(h.history().canUndo).toBe(true);
            expect(h.history().canRedo).toBe(false);
        } finally {
            h.unmount();
        }
    });
});
