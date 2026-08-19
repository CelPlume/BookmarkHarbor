/**
 * Header 组件 - 顶部导航栏（使用 HeroUI）
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
    Button,
    InputGroup,
    Dropdown,
    Modal,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import type { Theme, Locale, ExportScope } from '../core/types';

interface HeaderProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    locale: Locale;
    onLocaleChange: (locale: Locale) => void;
    sidebarOpen: boolean;
    onSidebarToggle: () => void;
    inspectorOpen: boolean;
    onInspectorToggle: () => void;
    selectedCount: number;
    onNewFolder: () => void;
    onNewBookmark: () => void;
    onImport: (files: FileList) => void;
    onExport: (scope: ExportScope) => void;
}

export const Header: React.FC<HeaderProps> = ({
    searchQuery,
    onSearchChange,
    searchInputRef,
    theme,
    onThemeChange,
    locale,
    onLocaleChange,
    sidebarOpen,
    onSidebarToggle,
    inspectorOpen,
    onInspectorToggle,
    selectedCount,
    onNewFolder,
    onNewBookmark,
    onImport,
    onExport,
}) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modalSearchRef = useRef<HTMLInputElement>(null);
    const [searchOpen, setSearchOpen] = useState(false);

    const currentThemeIcon = theme === 'dark' ? 'lucide:moon' : theme === 'light' ? 'lucide:sun' : 'lucide:monitor';

    const handleImportClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            onImport(files);
            e.target.value = '';
        }
    }, [onImport]);

    useEffect(() => {
        if (!searchOpen) return;
        const id = window.requestAnimationFrame(() => modalSearchRef.current?.focus());
        return () => window.cancelAnimationFrame(id);
    }, [searchOpen]);

    return (
        <header className="flex h-14 items-center justify-between border-b border-gray-200/80 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 max-[480px]:px-3 transition-colors">
            {/* 左侧 */}
            <div className="flex items-center gap-3 max-[480px]:gap-2">
                {/* 侧边栏切换 */}
                <Button
                    isIconOnly
                    variant={sidebarOpen ? 'primary' : 'tertiary'}
                    onPress={onSidebarToggle}
                    size="sm"
                    aria-label={t('aria.toggleSidebar')}
                >
                    <Icon icon="lucide:panel-left" className="h-5 w-5" aria-hidden="true" />
                </Button>

                {/* 新建 */}
                <div className="flex gap-2 max-[480px]:hidden">
                    <Button
                        variant="secondary"
                        size="sm"
                        onPress={onNewFolder}
                        className="bg-gray-100 dark:bg-gray-800"
                    >
                        <Icon icon="lucide:folder-plus" className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden sm:inline">{t('toolbar.newFolder')}</span>
                    </Button>
                    <Button
                        size="sm"
                        onPress={onNewBookmark}
                        className="bg-[var(--color-primary)] text-white hover:opacity-90 shadow-[0_4px_12px_rgba(var(--color-primary-rgb),0.18)]"
                    >
                        <Icon icon="lucide:plus" className="w-4 h-4" aria-hidden="true" />
                        <span className="hidden sm:inline">{t('toolbar.newBookmark')}</span>
                    </Button>
                </div>
                <div className="hidden max-[480px]:flex">
                    <Dropdown>
                        <Dropdown.Trigger>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="bg-gray-100 dark:bg-gray-800"
                                aria-label={t('toolbar.new')}
                            >
                                <Icon icon="lucide:plus" className="h-4 w-4" aria-hidden="true" />
                                {t('toolbar.new')}
                            </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label={t('toolbar.new')}
                                onAction={(key) => {
                                    if (key === 'newFolder') onNewFolder();
                                    else if (key === 'newBookmark') onNewBookmark();
                                }}
                            >
                                <Dropdown.Item id="newFolder">
                                    <Icon icon="lucide:folder-plus" className="w-4 h-4" />
                                    {t('toolbar.newFolder')}
                                </Dropdown.Item>
                                <Dropdown.Item id="newBookmark">
                                    <Icon icon="lucide:plus" className="w-4 h-4" />
                                    {t('toolbar.newBookmark')}
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
            </div>

            {/* 中间搜索框 */}
            <div className="hidden sm:flex max-w-md flex-1 px-8">
                <InputGroup className="hidden sm:flex max-w-md flex-1 px-8 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <InputGroup.Prefix>
                        <Icon icon="lucide:search" className="text-gray-400" aria-hidden="true" />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                        ref={searchInputRef}
                        type="text"
                        placeholder={t('search.placeholder')}
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        name="search"
                        autoComplete="off"
                        aria-label={t('search.placeholder')}
                        className="bg-transparent"
                    />
                    {searchQuery && (
                        <InputGroup.Suffix>
                            <Button
                                isIconOnly
                                variant="tertiary"
                                size="sm"
                                onPress={() => onSearchChange('')}
                                aria-label={t('aria.clearSearch')}
                            >
                                <Icon icon="lucide:x" className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </InputGroup.Suffix>
                    )}
                </InputGroup>
            </div>

            {/* 右侧控件 */}
            <div className="flex items-center gap-2 max-[480px]:gap-1">
                {/* Mobile search */}
                <Button
                    isIconOnly
                    variant="tertiary"
                    size="sm"
                    onPress={() => setSearchOpen(true)}
                    aria-label={t('search.placeholder')}
                    className="sm:hidden"
                >
                    <Icon icon="lucide:search" className="h-5 w-5" aria-hidden="true" />
                </Button>
                {/* 语言切换 */}
                <Dropdown>
                    <Dropdown.Trigger>
                        <Button isIconOnly variant="tertiary" size="sm" aria-label={t('aria.switchLanguage')}>
                            <Icon icon="lucide:languages" className="h-5 w-5" aria-hidden="true" />
                        </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover>
                        <Dropdown.Menu
                            aria-label="Language"
                            selectedKeys={new Set([locale])}
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                                const selected = Array.from(keys)[0] as Locale;
                                if (selected) onLocaleChange(selected);
                            }}
                        >
                            <Dropdown.Item id="zh">中文</Dropdown.Item>
                            <Dropdown.Item id="en">English</Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>

                {/* 主题切换 */}
                <Dropdown>
                    <Dropdown.Trigger>
                        <Button isIconOnly variant="tertiary" size="sm" aria-label={t('aria.switchTheme')}>
                            <Icon icon={currentThemeIcon} className="h-5 w-5" aria-hidden="true" />
                        </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover>
                        <Dropdown.Menu
                            aria-label="Theme"
                            selectedKeys={new Set([theme])}
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                                const selected = Array.from(keys)[0] as Theme;
                                if (selected) onThemeChange(selected);
                            }}
                        >
                            <Dropdown.Item id="light">
                                <Icon icon="lucide:sun" aria-hidden="true" />
                                {t('theme.light')}
                            </Dropdown.Item>
                            <Dropdown.Item id="dark">
                                <Icon icon="lucide:moon" aria-hidden="true" />
                                {t('theme.dark')}
                            </Dropdown.Item>
                            <Dropdown.Item id="system">
                                <Icon icon="lucide:monitor" aria-hidden="true" />
                                {t('theme.system')}
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>

                <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-2 max-[480px]:hidden" />

                <div className="flex items-center gap-2 max-[480px]:hidden">
                    {/* Import */}
                    <Button
                        isIconOnly
                        variant="tertiary"
                        size="sm"
                        onPress={handleImportClick}
                        aria-label={t('toolbar.import')}
                    >
                        <Icon icon="lucide:upload" className="w-4 h-4" aria-hidden="true" />
                    </Button>

                    {/* Export */}
                    <Dropdown>
                        <Dropdown.Trigger>
                            <Button
                                isIconOnly
                                variant="tertiary"
                                size="sm"
                                aria-label={t('toolbar.export')}
                            >
                                <Icon icon="lucide:download" className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label="Export options"
                                onAction={(key) => onExport(key as ExportScope)}
                            >
                                <Dropdown.Item id="all">
                                    {t('export.all')}
                                </Dropdown.Item>
                                <Dropdown.Item id="folder">
                                    {t('export.currentFolder')}
                                </Dropdown.Item>
                                <Dropdown.Item id="selection" isDisabled={selectedCount === 0}>
                                    {t('export.selection')}
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                />

                <div className="hidden max-[480px]:flex">
                    <Dropdown>
                        <Dropdown.Trigger>
                            <Button
                                variant="tertiary"
                                size="sm"
                                aria-label={t('toolbar.manage')}
                            >
                                <Icon icon="lucide:settings" className="w-4 h-4" aria-hidden="true" />
                                {t('toolbar.manage')}
                            </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label={t('toolbar.manage')}
                                onAction={(key) => {
                                    switch (key) {
                                        case 'import':
                                            handleImportClick();
                                            break;
                                        case 'exportAll':
                                            onExport('all');
                                            break;
                                        case 'exportFolder':
                                            onExport('folder');
                                            break;
                                        case 'exportSelection':
                                            onExport('selection');
                                            break;
                                    }
                                }}
                            >
                                <Dropdown.Item id="import">
                                    <Icon icon="lucide:upload" className="w-4 h-4" />
                                    {t('toolbar.import')}
                                </Dropdown.Item>
                                <Dropdown.Item id="exportAll">
                                    <Icon icon="lucide:download" className="w-4 h-4" />
                                    {t('export.all')}
                                </Dropdown.Item>
                                <Dropdown.Item id="exportFolder">
                                    <Icon icon="lucide:folder" className="w-4 h-4" />
                                    {t('export.currentFolder')}
                                </Dropdown.Item>
                                <Dropdown.Item id="exportSelection" isDisabled={selectedCount === 0}>
                                    <Icon icon="lucide:check-square" className="w-4 h-4" />
                                    {t('export.selection')}
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>

                {/* Inspector 切换 */}
                <Button
                    isIconOnly
                    variant={inspectorOpen ? 'primary' : 'tertiary'}
                    onPress={onInspectorToggle}
                    size="sm"
                    aria-label={t('aria.toggleInspector')}
                >
                    <Icon icon="lucide:panel-right" className="h-5 w-5" aria-hidden="true" />
                </Button>
            </div>

            {/* Mobile search modal */}
            <Modal isOpen={searchOpen} onOpenChange={(open) => { if (!open) setSearchOpen(false); }}>
                <Modal.Backdrop variant="blur">
                    <Modal.Container size="sm">
                        <Modal.Dialog>
                            <Modal.Header className="flex flex-col gap-1">{t('search.placeholder')}</Modal.Header>
                            <Modal.Body>
                                <InputGroup className="bg-gray-100 dark:bg-gray-800 rounded-full">
                                    <InputGroup.Prefix>
                                        <Icon icon="lucide:search" className="text-gray-400" aria-hidden="true" />
                                    </InputGroup.Prefix>
                                    <InputGroup.Input
                                        ref={modalSearchRef}
                                        type="text"
                                        placeholder={t('search.placeholder')}
                                        value={searchQuery}
                                        onChange={(e) => onSearchChange(e.target.value)}
                                        name="search"
                                        autoComplete="off"
                                        aria-label={t('search.placeholder')}
                                        className="bg-transparent"
                                    />
                                    {searchQuery && (
                                        <InputGroup.Suffix>
                                            <Button
                                                isIconOnly
                                                variant="tertiary"
                                                size="sm"
                                                onPress={() => onSearchChange('')}
                                                aria-label={t('aria.clearSearch')}
                                            >
                                                <Icon icon="lucide:x" className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </InputGroup.Suffix>
                                    )}
                                </InputGroup>
                            </Modal.Body>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </header>
    );
};
