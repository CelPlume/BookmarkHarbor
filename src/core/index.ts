/**
 * Core 模块总导出
 */

// Types
export * from './types';

// Utils
export * from './utils';

// Validation
export * from './validation';

// Order Key
export { generateOrderKey, generateOrderKeys, rebalanceOrderKeys } from './orderKey';

// Cycle Detection
export { detectCycle, detectCycleForMultiple, getDescendantIds, getAncestorIds, buildBreadcrumbs } from './cycleDetection';

// Tags
export { collectTagCounts, filterByTags, normalizeTag, appendTag, removeTag } from './tags';

// Dedupe
export { normalizeUrl, findDuplicateGroups, planMerge, planMergeAll, TRACKING_PARAMS } from './dedupe';
export type { DuplicateGroup, MergePlan, MergeStrategy } from './dedupe';

// Cover
export {
    fnv1a,
    colorSeedFor,
    hueFor,
    colorsFor,
    initialFrom,
    generateCoverDataUrl,
    withGeneratedCover,
} from './cover';

// Search
export {
    parseQuery,
    isQueryEmpty,
    getPinyinIndex,
    clearPinyinCache,
    matchNode,
    searchNodes,
} from './search';
export type { ParsedQuery, PinyinIndex, MatchField, ScoredMatch } from './search';

// Storage
export * from './storage';

// Import/Export
export * from './importExport';

// Metadata
export * from './metadata';

// Hooks
export * from './hooks';
