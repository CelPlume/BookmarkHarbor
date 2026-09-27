/**
 * Hooks 模块导出
 */

export {
    useStorage,
    useNodes,
    useChildNodes,
    useNodeActions,
    useSettings,
    useRules,
    useTheme,
    useViewMode,
    useLocale,
} from './useStorage';

export {
    useSelection,
    handleItemClick,
    getSelectionInfo,
    type UseSelectionOptions,
    type UseSelectionReturn,
    type SelectionState,
} from './useSelection';

export {
    useKeyboardShortcuts,
    createRenameKeyHandler,
    type KeyboardShortcuts,
    type UseKeyboardShortcutsOptions,
    type RenameKeyboardHandlers,
} from './useKeyboard';

export {
    useHistory,
    type HistoryEntry,
    type UseHistoryOptions,
    type UseHistoryReturn,
} from './useHistory';
