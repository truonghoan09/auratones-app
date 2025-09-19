    // src/hooks/useModal.tsx
import { useState, useEffect } from 'react';

export const useModal = (onCloseCallback?: () => void) => {
  const [showModal, setShowModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleOpenModal = () => {
    setShowModal(true);
    setIsClosing(false);
  };

  const handleCloseModal = () => {
    setIsClosing(true);
  };

  useEffect(() => {
    if (isClosing) {
      const timer = setTimeout(() => {
        setShowModal(false);
        setIsClosing(false);
        if (onCloseCallback) {
          onCloseCallback();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isClosing, onCloseCallback]);

  return {
    showModal,
    isClosing,
    handleOpenModal,
    handleCloseModal
  };
};