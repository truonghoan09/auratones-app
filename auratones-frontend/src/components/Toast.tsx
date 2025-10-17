// src/components/Toast.tsx
import { useEffect, useState } from "react";
import "../styles/toast.scss";

type ToastProps = {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
};

const Toast = ({ message, type = "info", onClose }: ToastProps) => {
  const [exit, setExit] = useState(false);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setExit(true);
      setTimeout(onClose, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return <div className={`toast ${type} ${exit ? "toast-exit" : ""}`}>{message}</div>;
};

export default Toast;
