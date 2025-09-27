import { useEffect, useRef, useState } from "react";
import "../../styles/AddChordDialog.scss";

type Instrument = "guitar" | "ukulele" | "piano";

type NextPayload = {
  instrument: Instrument;
  symbol: string;
};

type Props = {
  isOpen: boolean;
  defaultInstrument?: Instrument;
  initialSymbol?: string;
  onClose: () => void;
  /** Luồng mới: chỉ chuyển tiếp qua editor, không xử lý visibility ở đây */
  onNext: (data: NextPayload) => Promise<void> | void;
};

export default function AddChordDialog({
  isOpen,
  defaultInstrument = "guitar",
  initialSymbol = "",
  onClose,
  onNext,
}: Props) {
  const [instrument, setInstrument] = useState<Instrument>(defaultInstrument);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [busy, setBusy] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset khi mở lại dialog
  useEffect(() => {
    if (isOpen) {
      setInstrument(defaultInstrument);
      setSymbol(initialSymbol);
    }
  }, [isOpen, defaultInstrument, initialSymbol]);

  // focus input khi mở
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  // ESC đóng; Enter → Tiếp theo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") {
        e.preventDefault();
        void handleNext();
      }
    };
    document.addEventListener("keydown", handler);
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

  const handleNext = async () => {
    if (!validate()) return;
    try {
      setBusy(true);
      await onNext({
        instrument,
        symbol: symbol.trim(),
      });
    } finally {
      setBusy(false);
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

        <div className="actions">
          <button className="btn btn-secondary" onClick={onClose} aria-label="Hủy">
            Hủy
          </button>

          <button
            className="btn btn-primary"
            onClick={handleNext}
            disabled={busy}
            aria-label="Tiếp theo"
            title="Enter"
          >
            {busy ? "Đang mở…" : "Tiếp theo"}
          </button>
        </div>
      </div>
    </div>
  );
}
