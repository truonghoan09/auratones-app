// src/components/UserSetup.tsx
import '../styles/auth.scss';

type UserSetupProps = {
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const UserSetup = ({ username, onConfirm, onCancel }: UserSetupProps) => {

  return (
    <div className="user-setup-modal">
      <div className="modal-content">
        <h2>Tài khoản chưa tồn tại!</h2>
        <p>Username <span className="username">"{username}"</span> chưa được đăng ký.</p>
        <p>Bạn có muốn đăng ký tài khoản với username này không?</p>
        <button
          onClick={onConfirm}
          className="confirm-btn"
        >
          OK
        </button>
        <button
          onClick={onCancel}
          className="cancel-btn"
        >
          Hủy bỏ
        </button>
      </div>
    </div>
  );
};

export default UserSetup;