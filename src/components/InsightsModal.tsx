/**
 * InsightsModal - 书签体检
 *
 * 把"你收藏了 3000 条、实际打开过 47 条"这件事摆到台面上。
 * 四个页签：概览、从未打开、最常使用、久未使用。
 *
 * 只读展示在前，处置动作在后：用户先看清事实，再决定要不要归档。
 */

import React, { useMemo, useState } from 'react';
import { Button, Modal } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import type { Node } from '../core/types';
import { buildLibraryReport, describeLastUse, STALE_DAYS } from '../core/insights';
import { cn } from '../core/utils';

type TabKey = 'overview' | 'neverUsed' | 'top' | 'stale';

interface InsightsModalProps {
    isOpen: boolean;
    nodes: Record<string, Node>;
    onClose: () => void;
    /** 把选中的书签归档到一个新文件夹 */
    onArchive: (nodeIds: string[]) => void;
}

export const InsightsModal: React.FC<InsightsModalProps> = ({
    isOpen,
    nodes,
    onClose,
    onArchive,
}) => {
    const { t } = useTranslation();
    const [tab, setTab] = useState<TabKey>('overview');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // now 用一次调用结果，避免同一屏里各处取到不同时间
    const report = useMemo(
        () => buildLibraryReport(nodes, Date.now()),
        [nodes]
    );

    const currentList = useMemo(() => {
        switch (tab) {
            case 'neverUsed': return report.neverUsed;
            case 'top': return report.top;
            case 'stale': return report.stale;
            default: return [];
        }
    }, [tab, report]);

    const toggle = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleArchive = () => {
        if (selected.size === 0) return;
        onArchive(Array.from(selected));
        setSelected(new Set());
        onClose();
    };

    const closeAndReset = () => {
        setSelected(new Set());
        setTab('overview');
        onClose();
    };

    const ratioPercent = Math.round(report.activeRatio * 100);

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open) closeAndReset();
            }}
        >
            <Modal.Backdrop variant="blur">
                <Modal.Container size="lg">
                    <Modal.Dialog>
                        <Modal.Header className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <Icon icon="lucide:stethoscope" className="w-5 h-5" aria-hidden="true" />
                                {t('insights.title')}
                            </div>
                            <p className="text-xs text-gray-500 font-normal">
                                {t('insights.subtitle')}
                            </p>
                        </Modal.Header>

                        <Modal.Body className="gap-4">
                            {/* 概览数字 */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <StatCard label={t('insights.total')} value={report.total} />
                                <StatCard label={t('insights.active')} value={report.used.length} tone="success" />
                                <StatCard label={t('insights.neverUsed')} value={report.neverUsed.length} tone="muted" />
                                <StatCard
                                    label={t('insights.stale', { days: STALE_DAYS })}
                                    value={report.stale.length}
                                    tone="warning"
                                />
                            </div>

                            {/* 活跃占比条 */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>{t('insights.activeRatio')}</span>
                                    <span className="font-medium">{ratioPercent}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-[rgb(var(--color-primary-500-rgb))] transition-all"
                                        style={{ width: `${ratioPercent}%` }}
                                    />
                                </div>
                            </div>

                            {/* 页签 */}
                            <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5">
                                {(['overview', 'neverUsed', 'top', 'stale'] as const).map(key => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setTab(key)}
                                        className={cn(
                                            'flex-1 px-2 py-1.5 text-xs rounded-lg transition-colors',
                                            tab === key
                                                ? 'bg-white dark:bg-gray-800 font-medium shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        )}
                                    >
                                        {t(`insights.tab${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
                                    </button>
                                ))}
                            </div>

                            {tab === 'overview' ? (
                                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                                    <p>{report.total === 0 ? t('insights.empty') : t('insights.topHint')}</p>
                                    {report.top.length > 0 && (
                                        <div className="space-y-1">
                                            {report.top.slice(0, 5).map((node, index) => (
                                                <div key={node.id} className="flex items-center gap-2">
                                                    <span className="w-5 text-xs text-gray-400 text-right">
                                                        {index + 1}
                                                    </span>
                                                    <span className="truncate flex-1">{node.title}</span>
                                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                                        {t('insights.times', { count: node.useCount ?? 0 })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-400 pt-2">{t('insights.privacyNote')}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-gray-500">
                                            {tab === 'neverUsed' && t('insights.neverUsedHint')}
                                            {tab === 'stale' && t('insights.staleHint')}
                                            {tab === 'top' && t('insights.topHint')}
                                        </p>
                                        {currentList.length > 0 && (
                                            <button
                                                type="button"
                                                className="text-xs text-[rgb(var(--color-primary-600-rgb))] flex-shrink-0 ml-2"
                                                onClick={() => {
                                                    const allSelected = currentList.every(n => selected.has(n.id));
                                                    setSelected(allSelected
                                                        ? new Set()
                                                        : new Set(currentList.map(n => n.id)));
                                                }}
                                            >
                                                {t('insights.selectAll')}
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10">
                                        {currentList.length === 0 ? (
                                            <p className="py-8 text-center text-sm text-gray-500">
                                                {t('insights.empty')}
                                            </p>
                                        ) : (
                                            currentList.map(node => (
                                                <label
                                                    key={node.id}
                                                    className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 dark:border-white/5 last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                                                >
                                                    {/* 用原生 checkbox：项目里没有 Checkbox 的既有用法，
                                                        HeroUI 的复合写法需要 Control/Indicator 子元素，
                                                        这里取零风险的等价方案 */}
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(node.id)}
                                                        onChange={() => toggle(node.id)}
                                                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-[rgb(var(--color-primary-500-rgb))]"
                                                    />
                                                    <span className="truncate flex-1 text-sm">{node.title}</span>
                                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                                        {node.useCount
                                                            ? t('insights.times', { count: node.useCount })
                                                            : describeLastUse(node, Date.now()) === 'NEVER_USED'
                                                                ? t('insights.neverOpened')
                                                                : describeLastUse(node, Date.now())}
                                                    </span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </Modal.Body>

                        <Modal.Footer className="flex-wrap gap-2">
                            <Button variant="tertiary" onPress={closeAndReset}>
                                {t('duplicates.cancel')}
                            </Button>
                            {selected.size > 0 && (
                                <Button variant="primary" onPress={handleArchive}>
                                    <Icon icon="lucide:archive" className="w-4 h-4" aria-hidden="true" />
                                    {t('insights.archive')}（{selected.size}）
                                </Button>
                            )}
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
};

/** 概览里的单个数字卡片 */
const StatCard: React.FC<{
    label: string;
    value: number;
    tone?: 'success' | 'warning' | 'muted';
}> = ({ label, value, tone }) => {
    const valueClass = {
        success: 'text-success-600 dark:text-success-400',
        warning: 'text-warning-600 dark:text-warning-400',
        muted: 'text-gray-400',
    }[tone ?? 'muted'];

    return (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
            <div className={cn('text-xl font-semibold', valueClass)}>{value}</div>
            <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{label}</div>
        </div>
    );
};
