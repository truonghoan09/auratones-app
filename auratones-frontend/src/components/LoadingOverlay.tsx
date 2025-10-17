import React from "react";
import "../styles/loading-overlay.scss";
import { useI18n } from "../contexts/I18nContext";

type Props = {
  open: boolean;
  label?: string;     // i18n: ví dụ t("common.loading")
  subLabel?: string;  // i18n: ví dụ t("common.please_wait")
};

/**
 * Modal overlay toàn màn hình cho các tác vụ cần thời gian (fetch, login, save…)
 * Không cho đóng để tránh ngắt flow.
 */
const LoadingOverlay: React.FC<Props> = ({ open, label, subLabel }) => {
  const { t } = useI18n();

  if (!open) return null;

  const finalLabel = label ?? t("common.loading");
  const finalSub   = subLabel ?? t("common.please_wait");

  return (
    <div
      className="loading-overlay"
      role="alert"
      aria-busy="true"
      aria-live="polite"
      aria-label={`${finalLabel}${finalSub ? ` — ${finalSub}` : ""}`}
    >
      <div className="lo-panel">
        {/* Dãy chấm nhảy theo thứ tự, nằm đúng 1 hàng */}
        <div className="lo-dots" aria-hidden="true">
          <span className="dot d1" />
          <span className="dot d2" />
          <span className="dot d3" />
          <span className="dot d4" />
        </div>

        {(finalLabel || finalSub) && (
          <div className="lo-text">
            {finalLabel && <div className="lo-title">{finalLabel}</div>}
            {finalSub && <div className="lo-sub">{finalSub}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;
