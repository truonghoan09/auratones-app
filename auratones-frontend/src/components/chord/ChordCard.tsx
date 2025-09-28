// src/components/chord/ChordCard.tsx
import React, { useRef, useMemo } from "react";
import type { ChordEntry } from "../../types/chord";
import ChordDiagram from "./ChordDiagram";
import PianoDiagram from "./PianoDiagram";
import "../../styles/ChordCard.scss";

// (tùy chọn) dùng helper để đặt tên nốt từ PC; nếu bạn chưa có file này,
// bỏ import và dùng SHARP_NAMES local ở dưới.
import { enharmonicNames } from "../../utils/chordSpelling";

type Props = {
  chord: ChordEntry;
  onOpen: (chord: ChordEntry) => void;
};

// fallback nếu không dùng utils/chordSpelling
const SHARP_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
const spellFromPc = (pc?: number): string | null => {
  if (pc == null || pc < 0 || pc > 11) return null;
  // mặc định ưu tiên dạng # cho quick view; khi cần đúng theo key, dùng chordSpelling.
  return SHARP_NAMES[pc as 0|1|2|3|4|5|6|7|8|9|10|11];
};

export default function ChordCard({ chord, onOpen }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        onOpen(chord);
        break;
      case "Escape":
        e.preventDefault();
        rootRef.current?.blur();
        break;
      default:
        break;
    }
  };

  // Tổng số voicing
  const total = chord.variants?.length ?? 0;
  const hasVoicing = total > 0 && !!chord.variants?.[0];

  // Tên hiển thị:
  // - Mặc định: symbol (ví dụ "C", "Am", "G7")
  // - Nếu voicing đầu có bass → append "/Bass" (ưu tiên bassLabel; fallback từ bassPc)
  const displayTitle = useMemo(() => {
    const base = chord.symbol;
    if (!hasVoicing) return base;

    const v0 = chord.variants![0];
    const bassLabel =
      v0.bassLabel ||
      (typeof v0.bassPc === "number"
        ? // dùng utils nếu có, fallback sang map local
          (enharmonicNames
            ? (enharmonicNames(v0.bassPc as any)[0] ?? spellFromPc(v0.bassPc))
            : spellFromPc(v0.bassPc))
        : null);

    return bassLabel ? `${base}/${bassLabel}` : base;
  }, [chord.symbol, hasVoicing, chord.variants]);

  // Piano demo cơ bản khi chưa có voicing (giữ nguyên behaviour cũ)
  const pianoNotes = hasVoicing ? [0, 4, 7] : [];

  return (
    <div
      ref={rootRef}
      className="chord-card"
      role="button"
      tabIndex={0}
      aria-label={`${displayTitle}. Nhấn Enter để mở chi tiết`}
      onClick={() => onOpen(chord)}
      onKeyDown={handleKey}
    >
      {/* Diagram / Placeholder */}
      <div className="thumb" aria-hidden>
        <div className="thumb__canvas" data-instrument={chord.instrument}>
          {hasVoicing ? (
            chord.instrument !== "piano" ? (
              <ChordDiagram
                shape={{ ...chord.variants![0], name: displayTitle }}
                numStrings={chord.instrument === "guitar" ? 6 : 4}
                showName={false}
              />
            ) : (
              <PianoDiagram notes={pianoNotes} />
            )
          ) : (
            <div className="thumb__empty">
              <div className="empty-illustration" aria-hidden="true" />
              <div className="empty-text">Chưa có thông tin</div>
            </div>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="meta">
        <div className="title" title={displayTitle}>
          {displayTitle}
        </div>

        {hasVoicing ? (
          <div className="voicing-badge">{total}</div>
        ) : (
          <div className="voicing-badge voicing--empty">—</div>
        )}
      </div>
    </div>
  );
}
