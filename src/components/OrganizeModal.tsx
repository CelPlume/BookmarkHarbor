/**
 * OrganizeModal - 自动整理规则的管理与执行
 *
 * 两个页签：规则编辑、模板添加。
 * 编辑器只负责收集输入；真正的匹配计算交给 core/rules，
 * 保证"预览看到什么"和"执行后得到什么"用的是同一份逻辑。
 */

import React, { useMemo, useState } from 'react';
import { Button, Modal, Select, ListBox } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import type { AutoOrganizeRule, Node, RuleCondition, RuleAction } from '../core/types';
import { planOrganize, validateRuleRegexes } from '../core/rules';
import { RULE_TEMPLATE_GROUPS, type RuleTemplateGroup } from '../core/ruleTemplates';
import { cn } from '../core/utils';
import { ThemeSwitch } from './ThemeSwitch';

interface OrganizeModalProps {
    isOpen: boolean;
    nodes: Record<string, Node>;
    rules: AutoOrganizeRule[];
    onClose: () => void;
    onAddRule: (rule: Omit<AutoOrganizeRule, 'priority' | 'createdAt' | 'updatedAt'>) => void;
    onUpdateRule: (id: string, patch: Partial<AutoOrganizeRule>) => void;
    onDeleteRule: (id: string) => void;
    onReorder: (orderedIds: string[]) => void;
    onAddTemplate: (group: RuleTemplateGroup) => void;
    onApply: (preview: ReturnType<typeof planOrganize>) => void;
}

/** 解析逗号分隔的标签输入 */
function parseTags(input: string): string[] {
    return input
        .split(/[,，]/)
        .map(s => s.trim())
        .filter(Boolean);
}

/** 文件夹扁平化，用于"移动到"选择器 */
function collectFolders(nodes: Record<string, Node>) {
    const result: Array<{ id: string; title: string; depth: number }> = [];

    const walk = (parentId: string | null, depth: number) => {
        Object.values(nodes)
            .filter(n => n.type === 'folder' && n.parentId === parentId && !n.deletedAt)
            .sort((a, b) => a.orderKey.localeCompare(b.orderKey))
            .forEach(folder => {
                result.push({ id: folder.id, title: folder.title, depth });
                walk(folder.id, depth + 1);
            });
    };

    walk('root', 0);
    return result;
}

export const OrganizeModal: React.FC<OrganizeModalProps> = ({
    isOpen,
    nodes,
    rules,
    onClose,
    onAddRule,
    onUpdateRule,
    onDeleteRule,
    onReorder,
    onAddTemplate,
    onApply,
}) => {
    const { t } = useTranslation();
    const [tab, setTab] = useState<'rules' | 'templates'>('rules');
    const [previewOpen, setPreviewOpen] = useState(false);

    const folders = useMemo(() => collectFolders(nodes), [nodes]);

    // 预览与执行共用同一份计算结果
    const preview = useMemo(() => planOrganize(nodes, rules), [nodes, rules]);

    const handleApply = () => {
        onApply(preview);
        setPreviewOpen(false);
        onClose();
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onOpenChange={(open) => {
                    if (!open) onClose();
                }}
            >
                <Modal.Backdrop variant="blur">
                    <Modal.Container size="lg">
                        <Modal.Dialog>
                            <Modal.Header className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <Icon icon="lucide:wand-sparkles" className="w-5 h-5" aria-hidden="true" />
                                    {t('organize.title')}
                                </div>
                            </Modal.Header>

                            <Modal.Body className="gap-4">
                                {/* 用普通按钮做页签：项目其他地方也是这种朴素的切换，
                                    不引入未在别处验证过的 Tabs 复合组件 */}
                                <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/5">
                                    {(['rules', 'templates'] as const).map(key => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setTab(key)}
                                            className={cn(
                                                'flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors',
                                                tab === key
                                                    ? 'bg-white dark:bg-gray-800 font-medium shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                            )}
                                        >
                                            {key === 'rules' ? t('organize.title') : t('organize.addFromTemplate')}
                                        </button>
                                    ))}
                                </div>

                                {tab === 'templates' ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {t('organize.templateHint')}
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {RULE_TEMPLATE_GROUPS.map(group => (
                                                <button
                                                    key={group.key}
                                                    type="button"
                                                    onClick={() => {
                                                        onAddTemplate(group);
                                                        setTab('rules');
                                                    }}
                                                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                                                >
                                                    <span className="text-sm font-medium">
                                                        {t(`organize.templateGroup_${group.key}`)}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {group.rules.length}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : rules.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-gray-500">
                                        {t('organize.empty')}
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {rules.map((rule, index) => (
                                            <RuleCard
                                                key={rule.id}
                                                rule={rule}
                                                index={index}
                                                total={rules.length}
                                                folders={folders}
                                                onUpdate={onUpdateRule}
                                                onDelete={onDeleteRule}
                                                onReorder={onReorder}
                                                rules={rules}
                                            />
                                        ))}
                                    </div>
                                )}
                            </Modal.Body>

                            <Modal.Footer className="flex-wrap gap-2">
                                <Button variant="tertiary" onPress={onClose}>
                                    {t('duplicates.cancel')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onPress={() => onAddRule({
                                        id: `rule-${Math.random().toString(36).slice(2, 10)}`,
                                        name: t('organize.ruleNamePlaceholder'),
                                        enabled: true,
                                        when: {},
                                        then: {},
                                    })}
                                >
                                    {t('organize.addRule')}
                                </Button>
                                <Button
                                    variant="primary"
                                    isDisabled={preview.affectedCount === 0}
                                    onPress={() => setPreviewOpen(true)}
                                >
                                    {t('organize.preview')}
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>

            {/* 预览确认：执行前让用户看清会改什么 */}
            <Modal
                isOpen={previewOpen}
                onOpenChange={(open) => {
                    if (!open) setPreviewOpen(false);
                }}
            >
                <Modal.Backdrop variant="blur">
                    <Modal.Container size="md">
                        <Modal.Dialog>
                            <Modal.Header className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <Icon icon="lucide:list-checks" className="w-5 h-5" aria-hidden="true" />
                                    {t('organize.previewTitle')}
                                </div>
                            </Modal.Header>

                            <Modal.Body className="gap-4">
                                {preview.affectedCount === 0 ? (
                                    <p className="text-sm text-gray-500">{t('organize.previewEmpty')}</p>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            {t('organize.previewSummary', {
                                                affected: preview.affectedCount,
                                                move: preview.moveCount,
                                                tag: preview.tagCount,
                                                flag: preview.flagCount,
                                            })}
                                        </p>
                                        <div className="space-y-1.5 rounded-xl border border-gray-200 dark:border-white/10 p-3">
                                            {preview.details.map(d => (
                                                <div key={d.ruleId} className="flex items-center justify-between text-sm">
                                                    <span className="truncate text-gray-600 dark:text-gray-400">
                                                        {d.ruleName}
                                                    </span>
                                                    <span className="text-gray-400 flex-shrink-0 ml-2">
                                                        {t('organize.previewDetail', { rule: '', count: d.nodeIds.length })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </Modal.Body>

                            <Modal.Footer>
                                <Button variant="tertiary" onPress={() => setPreviewOpen(false)}>
                                    {t('organize.previewCancel')}
                                </Button>
                                <Button
                                    variant="primary"
                                    isDisabled={preview.affectedCount === 0}
                                    onPress={handleApply}
                                >
                                    {t('organize.previewConfirm')}
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </>
    );
};

/** 单条规则的编辑卡片 */
const RuleCard: React.FC<{
    rule: AutoOrganizeRule;
    index: number;
    total: number;
    rules: AutoOrganizeRule[];
    folders: Array<{ id: string; title: string; depth: number }>;
    onUpdate: (id: string, patch: Partial<AutoOrganizeRule>) => void;
    onDelete: (id: string) => void;
    onReorder: (ids: string[]) => void;
}> = ({ rule, index, total, rules, folders, onUpdate, onDelete, onReorder }) => {
    const { t } = useTranslation();
    const regexProblems = validateRuleRegexes(rule);

    const patchWhen = (patch: Partial<RuleCondition>) =>
        onUpdate(rule.id, { when: { ...rule.when, ...patch } });
    const patchThen = (patch: Partial<RuleAction>) =>
        onUpdate(rule.id, { then: { ...rule.then, ...patch } });

    const move = (delta: number) => {
        const ids = rules.map(r => r.id);
        const target = index + delta;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        onReorder(ids);
    };

    const inputClass =
        'w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-white/10 ' +
        'bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500';

    return (
        <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3 space-y-3">
            {/* 标题行 */}
            <div className="flex items-center gap-2">
                <ThemeSwitch
                    size="sm"
                    isSelected={rule.enabled}
                    onChange={(v) => onUpdate(rule.id, { enabled: v })}
                    aria-label={t('organize.enabled')}
                />
                <input
                    className={cn(inputClass, 'flex-1')}
                    value={rule.name}
                    onChange={(e) => onUpdate(rule.id, { name: e.target.value })}
                    placeholder={t('organize.ruleNamePlaceholder')}
                    aria-label={t('organize.ruleName')}
                />
                <Button
                    isIconOnly size="sm" variant="tertiary"
                    isDisabled={index === 0}
                    onPress={() => move(-1)}
                    aria-label={t('organize.moveUp')}
                >
                    <Icon icon="lucide:chevron-up" className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button
                    isIconOnly size="sm" variant="tertiary"
                    isDisabled={index === total - 1}
                    onPress={() => move(1)}
                    aria-label={t('organize.moveDown')}
                >
                    <Icon icon="lucide:chevron-down" className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button
                    isIconOnly size="sm" variant="tertiary"
                    onPress={() => onDelete(rule.id)}
                    aria-label={t('organize.delete')}
                >
                    <Icon icon="lucide:trash-2" className="w-4 h-4 text-danger-500" aria-hidden="true" />
                </Button>
            </div>

            {/* 条件 */}
            <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('organize.conditions')}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="space-y-1">
                        <span className="text-xs text-gray-500">{t('organize.condDomain')}</span>
                        <input
                            className={inputClass}
                            value={rule.when.domainContains ?? ''}
                            onChange={(e) => patchWhen({ domainContains: e.target.value || undefined })}
                            placeholder={t('organize.condDomainPlaceholder')}
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs text-gray-500">{t('organize.condTagIn')}</span>
                        <input
                            className={inputClass}
                            value={(rule.when.tagIn ?? []).join(', ')}
                            onChange={(e) => {
                                const tags = parseTags(e.target.value);
                                patchWhen({ tagIn: tags.length > 0 ? tags : undefined });
                            }}
                            placeholder={t('organize.condTagInPlaceholder')}
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs text-gray-500">{t('organize.condTitleRegex')}</span>
                        <input
                            className={cn(inputClass, regexProblems.some(p => p.includes('标题')) && 'border-danger-500')}
                            value={rule.when.titleRegex ?? ''}
                            onChange={(e) => patchWhen({ titleRegex: e.target.value || undefined })}
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs text-gray-500">{t('organize.condUrlRegex')}</span>
                        <input
                            className={cn(inputClass, regexProblems.some(p => p.includes('网址')) && 'border-danger-500')}
                            value={rule.when.urlRegex ?? ''}
                            onChange={(e) => patchWhen({ urlRegex: e.target.value || undefined })}
                        />
                    </label>
                </div>

                {regexProblems.length > 0 && (
                    <p className="text-xs text-danger-500">
                        {t('organize.invalidRegex')}：{regexProblems.join('；')}
                    </p>
                )}
            </div>

            {/* 动作 */}
            <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('organize.actions')}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="space-y-1">
                        <span className="text-xs text-gray-500">{t('organize.actMoveTo')}</span>
                        <Select
                            selectedKey={rule.then.moveToFolderId ?? 'none'}
                            onSelectionChange={(key) => {
                                if (key) patchThen({ moveToFolderId: key === 'none' ? undefined : String(key) });
                            }}
                            aria-label={t('organize.actMoveTo')}
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    <ListBox.Item id="none" textValue={t('organize.actMoveToNone')}>
                                        {t('organize.actMoveToNone')}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                    {folders.map(f => (
                                        <ListBox.Item key={f.id} id={f.id} textValue={f.title}>
                                            {f.title}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs text-gray-500">{t('organize.actAddTags')}</span>
                        <input
                            className={inputClass}
                            value={(rule.then.addTags ?? []).join(', ')}
                            onChange={(e) => {
                                const tags = parseTags(e.target.value);
                                patchThen({ addTags: tags.length > 0 ? tags : undefined });
                            }}
                            placeholder={t('organize.actAddTagsPlaceholder')}
                        />
                    </label>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                        <ThemeSwitch
                            size="sm"
                            isSelected={Boolean(rule.then.setFavorite)}
                            onChange={(v) => patchThen({ setFavorite: v || undefined })}
                            aria-label={t('organize.actFavorite')}
                        />
                        {t('organize.actFavorite')}
                    </label>
                    <label className="flex items-center gap-2">
                        <ThemeSwitch
                            size="sm"
                            isSelected={Boolean(rule.then.setReadLater)}
                            onChange={(v) => patchThen({ setReadLater: v || undefined })}
                            aria-label={t('organize.actReadLater')}
                        />
                        {t('organize.actReadLater')}
                    </label>
                </div>
            </div>
        </div>
    );
};
