// src/components/Toast.tsx
import { useEffect } from 'react';
import '../styles/toast.scss';

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

const toastClasses = `toast ${type}`;

  return <div className={toastClasses}>{message}</div>;
};

export default Toast;