/**
 * History Hook - reusable undo/redo controller
 *
 * 双栈用 useRef 持有、用 state 驱动重渲染。
 *
 * 为什么不直接把栈放在 useState 里：撤销需要在"出栈"的同时执行副作用
 * （调用 entry.undo()），而 useState 的更新函数必须是纯函数。
 * 在更新函数内部执行副作用并嵌套调用另一个 setter，会让 StrictMode 下
 * 的重复调用把副作用执行两次——实测确认过：一次撤销会撤销两条。
 *
 * 因此这里把栈放进 ref（随时可读可写、不参与协调），另用一个计数器
 * state 触发重渲染，副作用一律在更新函数之外执行。
 */

import { useCallback, useRef, useState } from 'react';

export interface HistoryEntry {
    undo: () => void;
    redo: () => void;
    label?: string;
    mergeKey?: string;
    timestamp?: number;
}

export interface UseHistoryOptions {
    limit?: number;
}

export interface UseHistoryReturn {
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
    record: (entry: HistoryEntry) => void;
    clear: () => void;
}

export function useHistory(options: UseHistoryOptions = {}): UseHistoryReturn {
    const limit = options.limit ?? 100;

    const pastRef = useRef<HistoryEntry[]>([]);
    const futureRef = useRef<HistoryEntry[]>([]);

    // 仅用于驱动重渲染：栈本身在 ref 里，state 只记录版本号
    const [version, setVersion] = useState(0);
    const bump = useCallback(() => setVersion((v) => v + 1), []);

    const record = useCallback((entry: HistoryEntry) => {
        const withTimestamp: HistoryEntry = {
            ...entry,
            timestamp: entry.timestamp ?? Date.now(),
        };

        const prev = pastRef.current;

        // 合并键与栈顶一致时并为一步：保留最早一次的 undo 与时间戳，
        // 采用最新的 redo，使连续输入只占一条历史
        if (withTimestamp.mergeKey && prev.length > 0) {
            const last = prev[prev.length - 1];
            if (last.mergeKey === withTimestamp.mergeKey) {
                pastRef.current = [
                    ...prev.slice(0, -1),
                    { ...withTimestamp, undo: last.undo, timestamp: last.timestamp },
                ];
                futureRef.current = [];
                bump();
                return;
            }
        }

        const next = [...prev, withTimestamp];
        if (next.length > limit) {
            next.shift();
        }
        pastRef.current = next;
        futureRef.current = [];
        bump();
    }, [limit, bump]);

    const undo = useCallback(() => {
        const prev = pastRef.current;
        if (prev.length === 0) return;

        const entry = prev[prev.length - 1];

        // 副作用先执行，再改栈——顺序反过来会在副作用抛错时丢历史
        entry.undo();

        pastRef.current = prev.slice(0, -1);
        futureRef.current = [entry, ...futureRef.current];
        bump();
    }, [bump]);

    const redo = useCallback(() => {
        const future = futureRef.current;
        if (future.length === 0) return;

        const entry = future[0];
        entry.redo();

        futureRef.current = future.slice(1);
        pastRef.current = [...pastRef.current, entry];
        bump();
    }, [bump]);

    const clear = useCallback(() => {
        pastRef.current = [];
        futureRef.current = [];
        bump();
    }, [bump]);

    // version 参与读取，保证每次 bump 后都能拿到最新的栈长度
    void version;
    const canUndo = pastRef.current.length > 0;
    const canRedo = futureRef.current.length > 0;

    return {
        canUndo,
        canRedo,
        undo,
        redo,
        record,
        clear,
    };
}
