// src/components/common/ActionDialog.tsx
import React, { useEffect, useMemo, useRef } from "react";
import "../../styles/ActionDialog.scss";

export type ActionVariant = "primary" | "secondary" | "danger" | "ghost";

export type ActionItem = {
  id?: string;
  label: React.ReactNode;          // text hoặc node (song ngữ/i18n render từ ngoài)
  onClick: () => void | Promise<void>;
  variant?: ActionVariant;
  autoFocus?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
};

type Props = {
  open: boolean;
  title?: React.ReactNode;         // tiêu đề (node)
  content?: React.ReactNode;       // nội dung tóm tắt; có thể bỏ để dùng children
  children?: React.ReactNode;      // nội dung tùy biến (form, tips…)
  actions?: ActionItem[];          // danh sách nút
  onClose: () => void;             // đóng dialog (ESC, backdrop)
  closeOnBackdrop?: boolean;       // default: true
  closeOnEsc?: boolean;            // default: true
  size?: "sm" | "md" | "lg";       // layout rộng/hẹp
  icon?: React.ReactNode;          // icon trái tiêu đề (tùy chọn)
  id?: string;                     // optional id cho test
};

const ActionDialog: React.FC<Props> = ({
  open,
  title,
  content,
  children,
  actions = [],
  onClose,
  closeOnBackdrop = true,
  closeOnEsc = true,
  size = "md",
  icon,
  id,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

  // focus target đầu tiên: ưu tiên nút có autoFocus
  const firstFocusableIndex = useMemo(() => {
    return Math.max(0, actions.findIndex((a) => a.autoFocus && !a.disabled));
  }, [actions]);

  // lock scroll khi mở
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, [open]);

  // ESC đóng
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      // trap focus cơ bản bằng Tab
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          (last as HTMLElement).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          (first as HTMLElement).focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEsc, onClose]);

  // autofocus nút đầu tiên
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      firstFocusableRef.current?.focus();
    });
  }, [open, firstFocusableIndex]);

  if (!open) return null;

  return (
    <div className="action-dialog" role="dialog" aria-modal="true" id={id}>
      <button
        className="ad-backdrop"
        aria-label="Close"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div className={`ad-panel ad-${size}`} role="document" ref={panelRef}>
        {(title || icon) && (
          <header className="ad-head">
            {icon && <div className="ad-icon" aria-hidden>{icon}</div>}
            {title && <h3 className="ad-title">{title}</h3>}
            <button className="ad-close" onClick={onClose} aria-label="Close">×</button>
          </header>
        )}

        {(content || children) && (
          <div className="ad-body">
            {content && <div className="ad-content">{content}</div>}
            {children && <div className="ad-children">{children}</div>}
          </div>
        )}

        {actions.length > 0 && (
          <footer className="ad-actions">
            {actions.map((a, idx) => (
              <button
                key={a.id ?? idx}
                className={`ad-btn ${a.variant ?? "secondary"}`}
                onClick={a.onClick}
                disabled={a.disabled}
                aria-label={a["aria-label"] || (typeof a.label === "string" ? a.label : undefined)}
                ref={idx === firstFocusableIndex ? firstFocusableRef : undefined}
              >
                {a.label}
              </button>
            ))}
          </footer>
        )}
      </div>
    </div>
  );
};

export default ActionDialog;
