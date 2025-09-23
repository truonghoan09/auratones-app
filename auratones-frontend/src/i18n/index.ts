// src/i18n/index.ts
import vi from './locales/vi';
import en from './locales/en';

export type Lang = 'vi' | 'en';
export const DEFAULT_LANG: Lang = 'vi';
export const SUPPORTED_LANGS: Lang[] = ['vi', 'en'];

// Tập hợp messages theo lang
export const MESSAGES: Record<Lang, any> = { vi, en };

// Truy cập giá trị theo đường dẫn "a.b.c"
export function getByPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

// Replace {placeholders} trong chuỗi
export function interpolate(str: string, params?: Record<string, any>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`));
}
