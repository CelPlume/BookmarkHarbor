/**
 * 国际化配置
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhTranslations from './translations/zh';
import enTranslations from './translations/en';

// 从 localStorage 获取语言设置
function getStoredLocale(): string {
    try {
        const stored = localStorage.getItem('aurabookmarks_data');
        if (stored) {
            const data = JSON.parse(stored);
            return data.settings?.locale || 'zh';
        }
    } catch {
        // ignore
    }

    // 尝试检测浏览器语言
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'en' ? 'en' : 'zh';
}

i18n
    .use(initReactI18next)
    .init({
        resources: {
            zh: {
                translation: zhTranslations,
            },
            en: {
                translation: enTranslations,
            },
        },
        lng: getStoredLocale(),
        fallbackLng: 'zh',
        interpolation: {
            escapeValue: false, // React 已经处理了 XSS
        },
    });

export default i18n;

/**
 * 切换语言
 */
export function changeLanguage(locale: 'zh' | 'en'): void {
    i18n.changeLanguage(locale);
}

/**
 * 获取当前语言
 */
export function getCurrentLanguage(): 'zh' | 'en' {
    return i18n.language as 'zh' | 'en';
}
