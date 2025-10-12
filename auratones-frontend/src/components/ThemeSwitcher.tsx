// src/components/ThemeSwitcher.tsx
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import '../styles/themeswitcher.scss';

const ThemeSwitcher = () => {
  const { theme, changeTheme } = useTheme();
  const { t } = useI18n();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Tất cả label lấy từ i18n
  const themes = [
    { name: t('header.theme.options.light'),  value: 'theme-light' },
    { name: t('header.theme.options.dark'),   value: 'theme-dark' },
    { name: t('header.theme.options.green'),  value: 'theme-green' },
    { name: t('header.theme.options.blue'),   value: 'theme-blue' },
    { name: t('header.theme.options.yellow'), value: 'theme-yellow' },
  ];

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleThemeChange = (newThemeValue: string) => {
    changeTheme(newThemeValue);
    setIsOpen(false);
  };

  const currentTheme = themes.find(ti => ti.value === theme)?.name || themes[0].name;

  return (
    <div className="theme-dropdown-container" ref={dropdownRef}>
      <button
        className="theme-dropdown-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('header.theme.aria')}
        title={t('header.theme.aria')}
      >
        {currentTheme}
        <span className="arrow">▼</span>
      </button>

      {isOpen && (
        <ul className="theme-dropdown-menu">
          {themes.map((tItem) => (
            <li key={tItem.value} onClick={() => handleThemeChange(tItem.value)}>
              <span className={`theme-color-box ${tItem.value}`}></span>
              {tItem.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ThemeSwitcher;
