// src/components/LanguageSwitcher.tsx
import React from 'react';
import { useI18n } from '../contexts/I18nContext';

export default function LanguageSwitcher() {
  const { lang, setLang, available } = useI18n();

  return (
    <div className="lang-switcher" role="group" aria-label="language switcher">
      {available.map((l) => (
        <button
          key={l}
          className={`lang-btn ${l === lang ? 'active' : ''}`}
          onClick={() => setLang(l)}
          aria-pressed={l === lang}
          title={l.toUpperCase()}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
