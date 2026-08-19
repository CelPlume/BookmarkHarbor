/**
 * SettingsModal 组件 - 设置弹窗
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    Modal,
    Button,
    Select,
    ListBox,
    Separator,
    Tooltip,
    Slider,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import type { Theme, Locale, CardFolderPreviewSize, ViewMode, SingleClickAction } from '../core/types';
import { cn } from '../core/utils';
import { ThemeSwitch } from './ThemeSwitch';

// 预设主题色
const THEME_COLORS = [
    '#3B82F6', // Blue (default)
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#EF4444', // Red
    '#F97316', // Orange
    '#10B981', // Green
    '#06B6D4', // Cyan
    '#6366F1', // Indigo
];

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    locale: Locale;
    onLocaleChange: (locale: Locale) => void;
    autoExpandTree: boolean;
    onAutoExpandTreeChange: (value: boolean) => void;
    cardFolderPreviewSize: CardFolderPreviewSize;
    onCardFolderPreviewSizeChange: (size: CardFolderPreviewSize) => void;
    defaultViewMode: ViewMode;
    onDefaultViewModeChange: (mode: ViewMode) => void;
    rememberFolderView: boolean;
    onRememberFolderViewChange: (value: boolean) => void;
    themeColor: string;
    onThemeColorChange: (color: string) => void;
    singleClickAction: SingleClickAction;
    onSingleClickActionChange: (action: SingleClickAction) => void;
    activeViewMode: ViewMode;
    cardColumnsDesktop: number;
    cardColumnsMobile: number;
    tileColumnsDesktop: number;
    tileColumnsMobile: number;
    onCardColumnsDesktopChange: (value: number) => void;
    onCardColumnsMobileChange: (value: number) => void;
    onTileColumnsDesktopChange: (value: number) => void;
    onTileColumnsMobileChange: (value: number) => void;
    onClearData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    theme,
    onThemeChange,
    locale,
    onLocaleChange,
    autoExpandTree,
    onAutoExpandTreeChange,
    cardFolderPreviewSize,
    onCardFolderPreviewSizeChange,
    defaultViewMode,
    onDefaultViewModeChange,
    rememberFolderView,
    onRememberFolderViewChange,
    themeColor,
    onThemeColorChange,
    singleClickAction,
    onSingleClickActionChange,
    activeViewMode,
    cardColumnsDesktop,
    cardColumnsMobile,
    tileColumnsDesktop,
    tileColumnsMobile,
    onCardColumnsDesktopChange,
    onCardColumnsMobileChange,
    onTileColumnsDesktopChange,
    onTileColumnsMobileChange,
    onClearData,
}) => {
    const { t } = useTranslation();
    const colorInputRef = useRef<HTMLInputElement>(null);
    const [isCompact, setIsCompact] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(max-width: 639px)');
        const update = () => setIsCompact(media.matches);
        update();
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', update);
            return () => media.removeEventListener('change', update);
        }
        media.addListener(update);
        return () => media.removeListener(update);
    }, []);

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Modal.Backdrop variant="blur">
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.Header className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <Icon icon="lucide:settings" className="w-5 h-5" />
                                {t('settings.title')}
                            </div>
                        </Modal.Header>
                        <Modal.Body className="gap-6">
                            {/* 外观设置 */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('settings.appearance')}
                                </h3>

                                {/* 主题 */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="lucide:palette" className="w-5 h-5 text-gray-400" />
                                        <span className="text-sm">{t('settings.theme')}</span>
                                    </div>
                                    <Select
                                        selectedKey={theme}
                                        onSelectionChange={(key) => {
                                            if (key) onThemeChange(key as Theme);
                                        }}
                                        className="w-52"
                                        aria-label={t('settings.theme')}
                                    >
                                        <Select.Trigger>
                                            <Select.Value className="flex items-center gap-2" />
                                            <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                            <ListBox>
                                                <ListBox.Item id="light" textValue={t('theme.light')}>
                                                    <Icon icon="lucide:sun" className="w-4 h-4" />
                                                    {t('theme.light')}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                                <ListBox.Item id="dark" textValue={t('theme.dark')}>
                                                    <Icon icon="lucide:moon" className="w-4 h-4" />
                                                    {t('theme.dark')}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                                <ListBox.Item id="system" textValue={t('theme.system')}>
                                                    <Icon icon="lucide:monitor" className="w-4 h-4" />
                                                    {t('theme.system')}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                </div>

                                {/* 语言 */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="lucide:languages" className="w-5 h-5 text-gray-400" />
                                        <span className="text-sm">{t('settings.language')}</span>
                                    </div>
                                    <Select
                                        selectedKey={locale}
                                        onSelectionChange={(key) => {
                                            if (key) onLocaleChange(key as Locale);
                                        }}
                                        className="w-52"
                                        aria-label={t('settings.language')}
                                    >
                                        <Select.Trigger>
                                            <Select.Value className="flex items-center gap-2" />
                                            <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                            <ListBox>
                                                <ListBox.Item id="zh" textValue="中文">中文<ListBox.ItemIndicator /></ListBox.Item>
                                                <ListBox.Item id="en" textValue="English">English<ListBox.ItemIndicator /></ListBox.Item>
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                </div>
                            </div>

                            <Separator className="my-4" />

                            {/* 行为设置 */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('settings.behavior')}
                                </h3>

                                {/* 自动展开目录树 */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="lucide:folder-tree" className="w-5 h-5 text-gray-400" />
                                        <span className="text-sm">{t('settings.autoExpandTree')}</span>
                                    </div>
                                    <ThemeSwitch
                                        size="sm"
                                        isSelected={autoExpandTree}
                                        onChange={onAutoExpandTreeChange}
                                    />
                                </div>

                                {/* 单击行为 */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="lucide:mouse-pointer-2" className="w-5 h-5 text-gray-400" />
                                        <span className="text-sm">{t('settings.singleClickAction')}</span>
                                    </div>
                                    <Select
                                        selectedKey={singleClickAction}
                                        onSelectionChange={(key) => {
                                            if (key) onSingleClickActionChange(key as SingleClickAction);
                                        }}
                                        className="w-52"
                                        aria-label={t('settings.singleClickAction')}
                                    >
                                        <Select.Trigger>
                                            <Select.Value className="flex items-center gap-2" />
                                            <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                            <ListBox>
                                                <ListBox.Item id="select" textValue={t('settings.singleClickSelect')}>
                                                    <Icon icon="lucide:check-square" className="w-4 h-4" />
                                                    {t('settings.singleClickSelect')}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                                <ListBox.Item id="open" textValue={t('settings.singleClickOpen')}>
                                                    <Icon icon="lucide:external-link" className="w-4 h-4" />
                                                    {t('settings.singleClickOpen')}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                </div>
                                {activeViewMode === 'card' && (
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <Icon icon="lucide:grid-2x2" className="w-5 h-5 text-gray-400" />
                                            <span className="text-sm">{t('settings.cardColumns')}</span>
                                        </div>
                                        <div className="flex items-center gap-3 w-52">
                                            <span className="text-xs text-gray-500 w-10">
                                                {isCompact ? t('settings.columnsMobile') : t('settings.columnsDesktop')}
                                            </span>
                                            <Slider
                                                className="flex-1"
                                                minValue={isCompact ? 1 : 2}
                                                maxValue={isCompact ? 4 : 9}
                                                step={1}
                                                value={isCompact ? cardColumnsMobile : cardColumnsDesktop}
                                                onChange={(value) => {
                                                    const next = Array.isArray(value) ? value[0] : value;
                                                    if (isCompact) {
                                                        onCardColumnsMobileChange(next);
                                                    } else {
                                                        onCardColumnsDesktopChange(next);
                                                    }
                                                }}
                                                aria-label={`${t('settings.cardColumns')} ${isCompact ? t('settings.columnsMobile') : t('settings.columnsDesktop')}`}
                                            >
                                                <Slider.Track>
                                                    <Slider.Fill className="bg-[rgb(var(--color-primary-500-rgb))]" />
                                                    <Slider.Thumb className="bg-white border border-gray-200" />
                                                </Slider.Track>
                                            </Slider>
                                            <span className="text-xs text-gray-500 w-4 text-right">
                                                {isCompact ? cardColumnsMobile : cardColumnsDesktop}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {activeViewMode === 'tile' && (
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <Icon icon="lucide:layout-grid" className="w-5 h-5 text-gray-400" />
                                            <span className="text-sm">{t('settings.tileColumns')}</span>
                                        </div>
                                        <div className="flex items-center gap-3 w-52">
                                            <span className="text-xs text-gray-500 w-10">
                                                {isCompact ? t('settings.columnsMobile') : t('settings.columnsDesktop')}
                                            </span>
                                            <Slider
                                                className="flex-1"
                                                minValue={isCompact ? 1 : 1}
                                                maxValue={isCompact ? 2 : 7}
                                                step={1}
                                                value={isCompact ? tileColumnsMobile : tileColumnsDesktop}
                                                onChange={(value) => {
                                                    const next = Array.isArray(value) ? value[0] : value;
                                                    if (isCompact) {
                                                        onTileColumnsMobileChange(next);
                                                    } else {
                                                        onTileColumnsDesktopChange(next);
                                                    }
                                                }}
                                                aria-label={`${t('settings.tileColumns')} ${isCompact ? t('settings.columnsMobile') : t('settings.columnsDesktop')}`}
                                            >
                                                <Slider.Track>
                                                    <Slider.Fill className="bg-[rgb(var(--color-primary-500-rgb))]" />
                                                    <Slider.Thumb className="bg-white border border-gray-200" />
                                                </Slider.Track>
                                            </Slider>
                                            <span className="text-xs text-gray-500 w-4 text-right">
                                                {isCompact ? tileColumnsMobile : tileColumnsDesktop}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* 卡片视图文件夹预览尺寸 */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="lucide:grid-3x3" className="w-5 h-5 text-gray-400" />
                                        <span className="text-sm">{t('settings.cardFolderPreviewSize')}</span>
                                    </div>
                                    <Select
                                        selectedKey={cardFolderPreviewSize}
                                        onSelectionChange={(key) => {
                                            if (key) onCardFolderPreviewSizeChange(key as CardFolderPreviewSize);
                                        }}
                                        className="w-52"
                                        aria-label={t('settings.cardFolderPreviewSize')}
                                    >
                                        <Select.Trigger>
                                            <Select.Value className="flex items-center gap-2" />
                                            <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                            <ListBox>
                                                <ListBox.Item id="2x2" textValue="2×2">2×2<ListBox.ItemIndicator /></ListBox.Item>
                                                <ListBox.Item id="3x3" textValue="3×3">3×3<ListBox.ItemIndicator /></ListBox.Item>
                                                <ListBox.Item id="4x3" textValue="4×3">4×3<ListBox.ItemIndicator /></ListBox.Item>
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                </div>

                                {/* 默认视图 */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="lucide:layout" className="w-5 h-5 text-gray-400" />
                                        <span className="text-sm">{t('settings.defaultView')}</span>
                                    </div>
                                    <Select
                                        selectedKey={defaultViewMode}
                                        onSelectionChange={(key) => {
                                            if (key) onDefaultViewModeChange(key as ViewMode);
                                        }}
                                        className="w-52"
                                        aria-label={t('settings.defaultView')}
                                    >
                                        <Select.Trigger>
                                            <Select.Value className="flex items-center gap-2" />
                                            <Select.Indicator />
                                        </Select.Trigger>
                                        <Select.Popover>
                                            <ListBox>
                                                <ListBox.Item id="list" textValue={t('viewMode.list')}>
                                                    <Icon icon="lucide:list" className="w-4 h-4" />
                                                    {t('viewMode.list')}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                                <ListBox.Item id="card" textValue={t('viewMode.card')}>
                                                    <Icon icon="lucide:grid-2x2" className="w-4 h-4" />
                                                    {t('viewMode.card')}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                                <ListBox.Item id="tile" textValue={t('viewMode.tile')}>
                                                    <Icon icon="lucide:layout-grid" className="w-4 h-4" />
                                                    {t('viewMode.tile')}
                                                    <ListBox.ItemIndicator />
                                                </ListBox.Item>
                                            </ListBox>
                                        </Select.Popover>
                                    </Select>
                                </div>

                                {/* 记忆文件夹视图 */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Icon icon="lucide:save" className="w-5 h-5 text-gray-400" />
                                        <span className="text-sm">{t('settings.rememberFolderView')}</span>
                                    </div>
                                    <ThemeSwitch
                                        size="sm"
                                        isSelected={rememberFolderView}
                                        onChange={onRememberFolderViewChange}
                                    />
                                </div>
                            </div>
                            <Separator className="my-4" />

                            {/* 主题色设置 */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    {t('settings.themeColor')}
                                </h3>

                                <div className="flex flex-wrap gap-2">
                                    {THEME_COLORS.map((color) => (
                                        <Tooltip key={color}>
                                            <Tooltip.Trigger>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        'w-8 h-8 rounded-full border-2 transition-transform hover:scale-110',
                                                        themeColor === color
                                                            ? 'border-gray-900 dark:border-white scale-110'
                                                            : 'border-transparent'
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => onThemeColorChange(color)}
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
                                                    value={themeColor}
                                                    onChange={(e) => onThemeColorChange(e.target.value)}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                            </button>
                                        </Tooltip.Trigger>
                                        <Tooltip.Content>{t('settings.customColor')}</Tooltip.Content>
                                    </Tooltip>
                                </div>
                            </div>
                            <Separator className="my-4" />

                            {/* 清除数据 */}
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">
                                        {t('settings.clearData')}
                                    </h3>
                                    <Button
                                        variant="danger"
                                        onPress={onClearData}
                                    >
                                        <Icon icon="lucide:trash-2" className="w-4 h-4" />
                                        {t('settings.clearData')}
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('settings.clearDataDescription')}
                                </p>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                variant="primary"
                                onPress={onClose}
                                className="bg-[rgb(var(--color-primary-500-rgb))] text-white hover:bg-[rgb(var(--color-primary-600-rgb))]"
                            >
                                {t('dialog.confirm')}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
};
