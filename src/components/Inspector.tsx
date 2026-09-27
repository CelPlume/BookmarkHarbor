/**
 * Inspector 组件 - 右侧属性面板（使用 HeroUI）
 */

import React, { useState, useCallback } from 'react';
import {
    Button,
    TextField,
    Label,
    Input,
    TextArea,
    Chip,
    FieldError,
    Tooltip,
    Separator,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import type { Node, UpdateNodeRequest } from '../core/types';
import { cn, fileToDataUrl, formatDate } from '../core/utils';
import { fetchMetadata, getFaviconUrl } from '../core/metadata';
import { httpUrlSchema, imageFileSchema } from '../core/validation';
import { normalizeTag, appendTag, removeTag } from '../core/tags';
import { generateCoverDataUrl, withGeneratedCover } from '../core/cover';

// 预设颜色
const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
    '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
    '#f43f5e', '#64748b',
];

interface InspectorProps {
    nodes: Record<string, Node>;
    selectedIds: Set<string>;
    fallbackId?: string;
    customColors: string[];
    onUpdate: (id: string, updates: UpdateNodeRequest) => void;
    onClose: () => void;
    onAddCustomColor: (color: string) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
    nodes,
    selectedIds,
    fallbackId,
    customColors,
    onUpdate,
    onClose,
    onAddCustomColor,
}) => {
    const { t } = useTranslation();
    const [isFetching, setIsFetching] = useState(false);
    const [customColorInput, setCustomColorInput] = useState('#6366f1');
    const colorInputRef = React.useRef<HTMLInputElement>(null);
    const [coverInputValue, setCoverInputValue] = useState('');
    const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
    const [coverUrlError, setCoverUrlError] = useState<string | null>(null);
    const [tagInput, setTagInput] = useState('');

    // 获取第一个选中的项目
    const firstId = Array.from(selectedIds)[0];
    const item = firstId ? nodes[firstId] : (fallbackId ? nodes[fallbackId] : null);

    const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !item) return;

        setCoverUploadError(null);
        const parsed = imageFileSchema.safeParse(file);
        if (!parsed.success) {
            setCoverUploadError(parsed.error.issues[0]?.message || 'Invalid image');
            return;
        }

        try {
            const dataUrl = await fileToDataUrl(file);
            onUpdate(item.id, { coverUrl: dataUrl, coverType: 'uploaded' });
        } catch (error) {
            console.error('Failed to read cover file:', error);
            setCoverUploadError('Failed to read image');
        }
    }, [item, onUpdate]);

    const handleCoverUrlSubmit = useCallback(() => {
        if (!item) return;

        const value = coverInputValue.trim();
        if (!value) {
            setCoverUrlError(null);
            return;
        }

        const parsed = httpUrlSchema.safeParse(value);
        if (!parsed.success) {
            setCoverUrlError(parsed.error.issues[0]?.message || 'Invalid URL');
            return;
        }

        setCoverUrlError(null);
        onUpdate(item.id, { coverUrl: value, coverType: 'remote' });
        setCoverInputValue('');
    }, [coverInputValue, item, onUpdate]);

    const handleFetchMetadata = useCallback(async () => {
        if (!item || !item.url) return;

        setIsFetching(true);
        try {
            const metadata = await fetchMetadata(item.url);

            const updates: UpdateNodeRequest = {};

            if (metadata.ogImageUrl) {
                updates.coverUrl = metadata.ogImageUrl;
                updates.coverType = 'remote';
            }

            if (metadata.bestIconUrl) {
                updates.iconUrl = metadata.bestIconUrl;
                updates.iconSource = 'favicon';
            }

            // 网站没有 og:image 时不留空封面，用确定性封面兜底
            if (!metadata.ogImageUrl && !item.coverUrl) {
                updates.coverUrl = generateCoverDataUrl({
                    ...item,
                    iconUrl: metadata.bestIconUrl ?? item.iconUrl,
                });
                updates.coverType = 'generated';
            }

            if (Object.keys(updates).length > 0) {
                onUpdate(item.id, updates);
            }
        } catch (error) {
            console.error('Failed to fetch metadata:', error);
            // 抓取被 CORS 拦截或超时时：先用站点默认图标，
            // 再补一张生成封面，界面上不至于空着
            const faviconUrl = getFaviconUrl(item.url);
            const updates: UpdateNodeRequest = {};

            if (faviconUrl) {
                updates.iconUrl = faviconUrl;
                updates.iconSource = 'favicon';
            }

            if (!item.coverUrl) {
                const generated = generateCoverDataUrl({
                    ...item,
                    iconUrl: faviconUrl || item.iconUrl,
                });
                updates.coverUrl = generated;
                updates.coverType = 'generated';
            }

            onUpdate(item.id, updates);
        } finally {
            setIsFetching(false);
        }
    }, [item, onUpdate]);

    // 无封面时按域名生成确定性封面（同一网站永远同色，不发网络请求）
    const handleRegenerateCover = useCallback(() => {
        if (!item) return;
        onUpdate(item.id, {
            coverUrl: generateCoverDataUrl(item),
            coverType: 'generated',
        });
    }, [item, onUpdate]);

    // 网址输入完成（失焦）时补一张生成封面
    //
    // 不在每次按键时生成：那样首个字符就会定下配色，后续输入不再更新。
    // 已有封面的不覆盖，只有这位用户自己换封面时才改变。
    const handleUrlBlur = useCallback(() => {
        if (!item || item.type === 'folder') return;
        const generated = withGeneratedCover(item);
        if (generated) {
            onUpdate(item.id, generated);
        }
    }, [item, onUpdate]);

    // 标签：写入时去重、去空白、忽略空串，保持用户录入顺序
    const handleAddTag = useCallback(() => {
        if (!item) return;
        const value = normalizeTag(tagInput);
        if (!value) return;
        onUpdate(item.id, { tags: appendTag(item.tags, value) });
        setTagInput('');
    }, [tagInput, item, onUpdate]);

    const handleRemoveTag = useCallback((tag: string) => {
        if (!item) return;
        onUpdate(item.id, { tags: removeTag(item.tags, tag) });
    }, [item, onUpdate]);

    if (!item) {
        return null;
    }

    const isFolder = item.type === 'folder';
    const isMultiple = selectedIds.size > 1;

    return (
        <div className="w-full h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-white/10 flex flex-col shadow-xl z-20">
            {/* 标题栏 */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-gray-100 dark:border-white/5 flex-shrink-0">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {t('inspector.title')}
                    {isMultiple && (
                        <span className="ml-2 text-gray-400 font-normal">
                            ({selectedIds.size})
                        </span>
                    )}
                </h3>
                <Button
                    isIconOnly
                    variant="tertiary"
                    size="sm"
                    onPress={onClose}
                    aria-label={t('aria.close')}
                >
                    <Icon icon="lucide:x" className="w-5 h-5" aria-hidden="true" />
                </Button>
            </div>

            {/* 内容区 */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {/* 封面预览 */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('inspector.preview')}
                    </label>
                    <div
                        className={cn(
                            'w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800',
                            'border border-gray-200 dark:border-white/10 relative group',
                            !item.coverUrl && 'flex items-center justify-center'
                        )}
                        style={{ backgroundColor: item.color || undefined }}
                    >
                        {item.coverUrl ? (
                            <img
                                src={item.coverUrl}
                                alt="Cover"
                                width={512}
                                height={512}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <span className="text-6xl text-gray-300 dark:text-gray-600 select-none font-bold">
                                {item.title.charAt(0).toUpperCase()}
                            </span>
                        )}

                        {/* 悬停遮罩 */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <label className="cursor-pointer">
                                <span className="inline-flex items-center justify-center h-9 px-4 text-sm text-white bg-white/20 backdrop-blur-md border border-white/30 rounded-full cursor-pointer">
                                    {t('inspector.changeCover')}
                                </span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    onChange={handleCoverUpload}
                                />
                            </label>
                            {!isFolder && item.url && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="bg-white/20 backdrop-blur-md border border-white/30 text-white"
                                    onPress={handleFetchMetadata}
                                    isPending={isFetching}
                                >
                                    {t('inspector.fetchMetadata')}
                                </Button>
                            )}
                            {!isFolder && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="bg-white/20 backdrop-blur-md border border-white/30 text-white"
                                    onPress={handleRegenerateCover}
                                >
                                    {t('inspector.generateCover')}
                                </Button>
                            )}
                        </div>
                    </div>

                    {coverUploadError && (
                        <p className="text-xs text-red-500">{coverUploadError}</p>
                    )}

                    {/* 封面 URL 输入 */}
                    <TextField
                        value={coverInputValue}
                        onChange={setCoverInputValue}
                        isInvalid={!!coverUrlError}
                        name="coverUrl"
                        aria-label={t('inspector.pasteUrl')}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleCoverUrlSubmit();
                            }
                        }}
                        onBlur={handleCoverUrlSubmit}
                    >
                        <Input placeholder={t('inspector.pasteUrl')} autoComplete="off" />
                        {coverUrlError && <FieldError>{coverUrlError}</FieldError>}
                    </TextField>
                </div>

                {/* 基本信息 */}
                <div className="space-y-4">
                    {/* 名称 */}
                    <TextField
                        value={item.title}
                        onChange={(value) => onUpdate(item.id, { title: value })}
                    >
                        <Label>{t('inspector.name')}</Label>
                        <Input name="title" autoComplete="off" />
                    </TextField>

                    {/* URL（仅书签） */}
                    {!isFolder && (
                        <TextField
                            value={item.url || ''}
                            onChange={(value) => onUpdate(item.id, { url: value })}
                        >
                            <Label>{t('inspector.url')}</Label>
                            <Input
                                name="url"
                                autoComplete="off"
                                onBlur={handleUrlBlur}
                                className="text-primary-600 dark:text-primary-400 font-mono"
                            />
                        </TextField>
                    )}
                </div>

                {/* 标签（跨目录的正交分类） */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('inspector.tags')}
                    </label>

                    {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {item.tags.map((tag) => (
                                <Chip key={tag} size="sm" variant="soft" color="accent">
                                    <Chip.Label>{tag}</Chip.Label>
                                    <button
                                        type="button"
                                        className="ml-1 rounded-full hover:text-danger-500 transition-colors"
                                        onClick={() => handleRemoveTag(tag)}
                                        aria-label={t('inspector.removeTag', { tag })}
                                    >
                                        <Icon icon="lucide:x" className="w-3 h-3" aria-hidden="true" />
                                    </button>
                                </Chip>
                            ))}
                        </div>
                    )}

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleAddTag();
                        }}
                    >
                        <TextField
                            value={tagInput}
                            onChange={setTagInput}
                        >
                            <Input
                                name="tag"
                                autoComplete="off"
                                aria-label={t('inspector.tags')}
                                placeholder={t('inspector.addTagPlaceholder')}
                            />
                        </TextField>
                    </form>
                </div>

                {/* 备注 */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('inspector.notes')}
                    </label>
                    <TextField
                        value={item.notes || ''}
                        onChange={(value) => onUpdate(item.id, { notes: value })}
                    >
                        <TextArea
                            name="notes"
                            rows={3}
                            autoComplete="off"
                            aria-label={t('inspector.notes')}
                            placeholder={t('inspector.notesPlaceholder')}
                        />
                    </TextField>
                </div>

                {/* 颜色选择 */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('inspector.color')}
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                        {PRESET_COLORS.map((color) => (
                            <Tooltip key={color}>
                                <Tooltip.Trigger>
                                    <button
                                        type="button"
                                        className={cn(
                                            'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                                            item.color === color
                                                ? 'border-gray-900 dark:border-white scale-110'
                                                : 'border-transparent'
                                        )}
                                        style={{ backgroundColor: color }}
                                        onClick={() => onUpdate(item.id, { color })}
                                    />
                                </Tooltip.Trigger>
                                <Tooltip.Content>{color}</Tooltip.Content>
                            </Tooltip>
                        ))}
                        {/* 自定义颜色历史 */}
                        {customColors.map((color) => (
                            <Tooltip key={color}>
                                <Tooltip.Trigger>
                                    <button
                                        type="button"
                                        className={cn(
                                            'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                                            item.color === color
                                                ? 'border-gray-900 dark:border-white scale-110'
                                                : 'border-transparent'
                                        )}
                                        style={{ backgroundColor: color }}
                                        onClick={() => onUpdate(item.id, { color })}
                                    />
                                </Tooltip.Trigger>
                                <Tooltip.Content>{color}</Tooltip.Content>
                            </Tooltip>
                        ))}
                        {/* 自定义颜色选择器 */}
                        <Tooltip>
                            <Tooltip.Trigger>
                                <button
                                    type="button"
                                    className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors relative overflow-hidden"
                                    onClick={() => colorInputRef.current?.click()}
                                >
                                    <Icon icon="lucide:plus" className="w-4 h-4 text-gray-400" aria-hidden="true" />
                                    <input
                                        ref={colorInputRef}
                                        type="color"
                                        value={customColorInput}
                                        onChange={(e) => setCustomColorInput(e.target.value)}
                                        onBlur={() => {
                                            if (customColorInput && !PRESET_COLORS.includes(customColorInput) && !customColors.includes(customColorInput)) {
                                                onAddCustomColor(customColorInput);
                                            }
                                            onUpdate(item.id, { color: customColorInput });
                                        }}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                </button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>{t('inspector.customColor')}</Tooltip.Content>
                        </Tooltip>
                        {/* 清除颜色 */}
                        <Tooltip>
                            <Tooltip.Trigger>
                                <button
                                    type="button"
                                    className={cn(
                                        'w-8 h-8 rounded-full border-2 flex items-center justify-center bg-gray-100 dark:bg-gray-800',
                                        !item.color
                                            ? 'border-gray-900 dark:border-white'
                                            : 'border-transparent'
                                    )}
                                    onClick={() => onUpdate(item.id, { color: undefined })}
                                >
                                    <Icon icon="lucide:ban" className="w-4 h-4 text-gray-400" aria-hidden="true" />
                                </button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>Remove color</Tooltip.Content>
                        </Tooltip>
                    </div>
                </div>

                <Separator />

                {/* 元数据 */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">{t('inspector.type')}</span>
                        <span className="text-gray-900 dark:text-gray-200 capitalize">
                            {t(`inspector.${item.type}`)}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">{t('inspector.created')}</span>
                        <span className="text-gray-900 dark:text-gray-200">
                            {formatDate(item.createdAt)}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">{t('inspector.updated')}</span>
                        <span className="text-gray-900 dark:text-gray-200">
                            {formatDate(item.updatedAt)}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">ID</span>
                        <span className="text-gray-400 font-mono text-[10px]">
                            {item.id.slice(0, 8)}...
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
