// src/contexts/ThemeContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemeContextType = {
  theme: string;
  changeTheme: (newTheme: string) => void;
};

type ThemeProviderProps = {
  children: ReactNode;
};

// Tạo một Context
const ThemeContext = createContext<ThemeContextType | null>(null);

// Tạo một Provider component để bọc ứng dụng của bạn
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  // 1. Lấy theme từ localStorage khi khởi động
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('app-theme');
    // Nếu có theme đã lưu, sử dụng nó. Ngược lại, dùng theme mặc định.
    return savedTheme || 'theme-light';
  });

  // 2. Lưu theme vào localStorage mỗi khi nó thay đổi
  useEffect(() => {
    localStorage.setItem('app-theme', theme);
  }, [theme]); // useEffect sẽ chạy mỗi khi biến 'theme' thay đổi

  // Hàm để thay đổi theme, nhận một tham số là tên theme mới
  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook tùy chỉnh để dễ dàng sử dụng theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};