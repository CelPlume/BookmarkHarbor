/**
 * Inspector 组件 - 右侧属性面板（使用 HeroUI）
 */

import React, { useState, useCallback } from 'react';
import {
    Button,
    TextField,
    Label,
    Input,
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

            if (Object.keys(updates).length > 0) {
                onUpdate(item.id, updates);
            }
        } catch (error) {
            console.error('Failed to fetch metadata:', error);
            // 尝试使用 favicon
            const faviconUrl = getFaviconUrl(item.url);
            if (faviconUrl) {
                onUpdate(item.id, { iconUrl: faviconUrl, iconSource: 'favicon' });
            }
        } finally {
            setIsFetching(false);
        }
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
                                className="text-primary-600 dark:text-primary-400 font-mono"
                            />
                        </TextField>
                    )}
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
