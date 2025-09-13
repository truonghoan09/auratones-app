// src/components/Toast.tsx
import { useEffect } from 'react';
import type { CSSProperties } from 'react';

type ToastProps = {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
};

const Toast = ({ message, type = 'info', onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Tự đóng sau 3 giây
    return () => clearTimeout(timer);
  }, [onClose]);

  const baseStyle: CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    color: 'white',
    marginBottom: '10px',
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 9999,
    backgroundColor: '#333'
  };

  switch (type) {
    case 'success':
      baseStyle.backgroundColor = '#4CAF50';
      break;
    case 'error':
      baseStyle.backgroundColor = '#f44336';
      break;
    case 'info':
      baseStyle.backgroundColor = '#2196F3';
      break;
  }

  return <div style={baseStyle}>{message}</div>;
};

export default Toast;