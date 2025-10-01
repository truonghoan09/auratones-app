// src/components/chord/ChordCard.tsx
import React, { useRef, useMemo } from "react";
import type { ChordEntry } from "../../types/chord";
import ChordDiagram from "./ChordDiagram";
import PianoDiagram from "./PianoDiagram";
import "../../styles/ChordCard.scss";

import { enharmonicNames } from "../../utils/chordSpelling";

// Quality map & types
import { QUALITY_MAP } from "../../constants/qualityMap";
import type { QualityKey, QualityValue } from "../../constants/qualityMap";

// Display mode context (symbol/text)
import { useDisplayMode } from "../../contexts/DisplayModeContext";

type Props = {
  chord: ChordEntry;
  onOpen: (chord: ChordEntry) => void;
};

// ====================
// Helpers
// ====================

// fallback nếu không dùng utils/chordSpelling
const SHARP_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
const spellFromPc = (pc?: number): string | null => {
  if (pc == null || pc < 0 || pc > 11) return null;
  return SHARP_NAMES[pc as 0|1|2|3|4|5|6|7|8|9|10|11];
};

// guard: string -> QualityKey trong QUALITY_MAP
const toQualityKey = (q: string): q is QualityKey =>
  Object.prototype.hasOwnProperty.call(QUALITY_MAP, q);

/**
 * Phân tách "Cmaj7", "Am", "G7#9", "Bbdim7", "F#sus4add9", …
 * và render quality theo displayMode ("symbol" | "text").
 * Trả về:
 *  - root: "C", "A", "G", "Bb", "F#"
 *  - qualRendered: phần quality đã map (ví dụ "Δ7", "–", "7♯9", …)
 *  - fullText: root + qualRendered (để set title/aria)
 */
const parseAndRenderQuality = (
  raw: string,
  displayMode: "symbol" | "text"
): { root: string; qualRendered: string; fullText: string } => {
  if (!raw) return { root: "", qualRendered: "", fullText: "" };

  const m = raw.match(/^(?<root>[A-G](?:#|b)?)(?<qual>.*)$/);
  if (!m || !m.groups) {
    return { root: raw, qualRendered: "", fullText: raw };
  }

  const root = m.groups.root;
  const qualAscii = (m.groups.qual || "") as string;

  // nếu không có hậu tố => coi như "maj" để map được Δ khi ở chế độ symbol
  const qualKey = qualAscii === "" ? "maj" : qualAscii;

  let rendered = "";
  if (toQualityKey(qualKey)) {
    const entry: QualityValue = QUALITY_MAP[qualKey];
    rendered = entry[displayMode];
  } else {
    // không có trong map → giữ nguyên để không “mất” quality lạ
    rendered = qualAscii;
  }

  return { root, qualRendered: rendered, fullText: `${root}${rendered}` };
};

export default function ChordCard({ chord, onOpen }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { mode } = useDisplayMode(); // "symbol" | "text"

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

  // Tách root + quality (rendered) để hiển thị quality dạng superscript
  const { root, qualRendered, fullText } = useMemo(
    () => parseAndRenderQuality(chord.symbol, mode),
    [chord.symbol, mode]
  );

  // xử lý slash bass như cũ (không superscript phần /Bass)
  const { titleAttr, bass } = useMemo(() => {
    if (!hasVoicing) return { titleAttr: fullText, bass: null as string | null };

    const v0 = chord.variants![0];
    const bassLabel =
      v0.bassLabel ||
      (typeof v0.bassPc === "number"
        ? (enharmonicNames
            ? (enharmonicNames(v0.bassPc as any)[0] ?? spellFromPc(v0.bassPc))
            : spellFromPc(v0.bassPc))
        : null);

    return { titleAttr: bassLabel ? `${fullText}/${bassLabel}` : fullText, bass: bassLabel };
  }, [fullText, hasVoicing, chord.variants]);

  // Piano demo cơ bản khi chưa có voicing (giữ nguyên behaviour cũ)
  const pianoNotes = hasVoicing ? [0, 4, 7] : [];

  return (
    <div
      ref={rootRef}
      className="chord-card"
      role="button"
      tabIndex={0}
      aria-label={`${titleAttr}. Nhấn Enter để mở chi tiết`}
      onClick={() => onOpen(chord)}
      onKeyDown={handleKey}
    >
      {/* Diagram / Placeholder */}
      <div className="thumb" aria-hidden>
        <div className="thumb__canvas" data-instrument={chord.instrument}>
          {hasVoicing ? (
            chord.instrument !== "piano" ? (
              <ChordDiagram
                shape={{ ...chord.variants![0], name: titleAttr }}
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
        <div className="title" title={titleAttr}>
          <span className="title__root">{root}</span>
          {qualRendered ? <sup className="title__qual">{qualRendered}</sup> : null}
          {bass ? <span className="title__slash">/{bass}</span> : null}
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
