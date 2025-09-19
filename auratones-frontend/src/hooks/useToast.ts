// src/hooks/useToast.ts
import { useState } from 'react';

export const useToast = () => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'success' | 'error' | 'info'>('info');

  const showToast = (msg: string, toastType: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setType(toastType);
  };

  const hideToast = () => {
    setMessage('');
  };

  return { message, type, showToast, hideToast };
};