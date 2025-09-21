import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/themeswitcher.scss';

const ThemeSwitcher = () => {
  const { theme, changeTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null); 

  const themes = [
    { name: 'Sáng', value: 'theme-light' },
    { name: 'Tối', value: 'theme-dark' },
    { name: 'Xanh lá', value: 'theme-green' },
    { name: 'Xanh dương', value: 'theme-blue' },
    { name: 'Vàng', value: 'theme-yellow' },
  ];

  // Logic để đóng dropdown khi bấm ra ngoài
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleThemeChange = (newThemeValue: string) => {
    changeTheme(newThemeValue);
    setIsOpen(false); // Đóng dropdown sau khi chọn theme
  };

  const currentTheme = themes.find(t => t.value === theme)?.name || 'Sáng';

  return (
    <div className="theme-dropdown-container" ref={dropdownRef}>
      <button 
        className="theme-dropdown-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        {currentTheme}
        <span className="arrow">▼</span>
      </button>

      {isOpen && (
        <ul className="theme-dropdown-menu">
          {themes.map((t) => (
            <li key={t.value} onClick={() => handleThemeChange(t.value)}>
              <span className={`theme-color-box ${t.value}`}></span>
              {t.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ThemeSwitcher;