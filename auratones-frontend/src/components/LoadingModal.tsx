import React from 'react';
import '../styles/_loading-modal.scss';

interface LoadingModalProps {
  isOpen: boolean;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ isOpen }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="loading-modal-overlay">
      <div className="loading-modal-content">
        <div className="loading-spinner"></div>
        <p>Đang tải...</p>
      </div>
    </div>
  );
};

export default LoadingModal;