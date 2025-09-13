// src/components/UserSetup.tsx
import React from 'react';
import type { CSSProperties } from 'react';

type UserSetupProps = {
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const UserSetup = ({ username, onConfirm, onCancel }: UserSetupProps) => {
  const baseStyle: CSSProperties = {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  };

  const modalStyle: CSSProperties = {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    maxWidth: '400px',
    textAlign: 'center',
  };

  return (
    <div style={baseStyle}>
      <div style={modalStyle}>
        <h2>Tài khoản chưa tồn tại!</h2>
        <p>Username <span style={{ fontWeight: 'bold' }}>"{username}"</span> chưa được đăng ký.</p>
        <p>Bạn có muốn đăng ký tài khoản với username này không?</p>
        <button
          onClick={onConfirm}
          style={{ padding: '10px', background: '#4CAF50', color: 'white', border: 'none', marginRight: '10px' }}
        >
          OK
        </button>
        <button
          onClick={onCancel}
          style={{ padding: '10px', background: 'transparent', color: '#555', border: '1px solid #ccc' }}
        >
          Hủy bỏ
        </button>
      </div>
    </div>
  );
};

export default UserSetup;