import { useEffect } from 'react';
import '../styles/toast.scss';

type ToastProps = {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
};

const Toast = ({ message, type = 'info', onClose }: ToastProps) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  const toastClasses = `toast ${type}`;
  return <div className={toastClasses}>{message}</div>;
};

export default Toast;
