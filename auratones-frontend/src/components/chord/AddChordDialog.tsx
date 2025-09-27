import { useEffect, useRef, useState } from "react";
import "../../styles/AddChordDialog.scss";

type Instrument = "guitar" | "ukulele" | "piano";
type Visibility = "private" | "contribute";

type AddChordPayload = {
  instrument: Instrument;
  symbol: string;
  visibility: Visibility;
};

type Props = {
  isOpen: boolean;
  defaultInstrument?: Instrument;
  initialSymbol?: string;
  onClose: () => void;
  onSubmit: (data: AddChordPayload) => Promise<void> | void;
};

export default function AddChordDialog({
  isOpen,
  defaultInstrument = "guitar",
  initialSymbol = "",
  onClose,
  onSubmit,
}: Props) {
  const [instrument, setInstrument] = useState<Instrument>(defaultInstrument);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [submitting, setSubmitting] = useState<Visibility | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // focus vào input khi mở
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  // ESC đóng; Ctrl/Cmd+Enter => Lưu riêng tư
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        void handleSubmit("private");
      }
    };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, instrument, symbol]);

  if (!isOpen) return null;

  const validate = () => {
    const s = symbol.trim();
    if (!s) {
      (window as any).__toast?.("Vui lòng nhập ký hiệu hợp âm", "error");
      return false;
    }
    return true;
  };

  const handleSubmit = async (visibility: Visibility) => {
    if (!validate()) return;
    try {
      setSubmitting(visibility);
      await onSubmit({
        instrument,
        symbol: symbol.trim(),
        visibility,
      });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="addchord-backdrop" role="presentation" onClick={onClose}>
      <div
        className="addchord-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="addchord-title"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
      >
        <h2 id="addchord-title">Thêm hợp âm mới</h2>

        <label className="field">
          <span>Nhạc cụ</span>
          <select
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as Instrument)}
            aria-label="Nhạc cụ"
          >
            <option value="guitar">Guitar</option>
            <option value="ukulele">Ukulele</option>
            <option value="piano">Piano</option>
          </select>
        </label>

        <label className="field">
          <span>Ký hiệu hợp âm thôi là được</span>
          <input
            ref={inputRef}
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Ví dụ: Cmaj7 hoặc Cm"
            aria-label="Ký hiệu hợp âm"
          />
        </label>

        <div className="actions split-actions">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            aria-label="Hủy"
          >
            Hủy
          </button>

          <div className="cta-group">
            <button
              className="btn btn-ghost"
              onClick={() => handleSubmit("contribute")}
              disabled={!!submitting}
              aria-label="Gửi đóng góp"
            >
              {submitting === "contribute" ? "Đang gửi…" : "Gửi đóng góp"}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSubmit("private")}
              disabled={!!submitting}
              aria-label="Lưu riêng tư"
              title="Ctrl/⌘ + Enter"
            >
              {submitting === "private" ? "Đang lưu…" : "Lưu riêng tư"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
