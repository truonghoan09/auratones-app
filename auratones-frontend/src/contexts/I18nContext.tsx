// src/contexts/I18nContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANG, SUPPORTED_LANGS, MESSAGES, getByPath, interpolate, type Lang } from '../i18n';

type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, any>) => string;
  available: Lang[];
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'lang';

function resolveInitialLang(): Lang {
  const fromLS = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (fromLS && SUPPORTED_LANGS.includes(fromLS)) return fromLS;
  const nav = navigator.language || (navigator as any).userLanguage || '';
  if (nav.toLowerCase().startsWith('vi')) return 'vi';
  return DEFAULT_LANG;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(resolveInitialLang());

  // cập nhật html lang để SEO/a11y
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const setLang = (l: Lang) => {
    if (!SUPPORTED_LANGS.includes(l)) return;
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };

  // Hàm dịch: thử lang hiện tại -> fallback EN -> trả key nếu không tìm thấy
  const t = (key: string, params?: Record<string, any>) => {
    const val =
      getByPath(MESSAGES[lang], key) ??
      getByPath(MESSAGES.en, key) ??
      key;
    if (typeof val === 'string') return interpolate(val, params);
    return typeof val === 'number' ? String(val) : key;
  };

  const value = useMemo<I18nContextType>(() => ({
    lang,
    setLang,
    t,
    available: SUPPORTED_LANGS,
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
