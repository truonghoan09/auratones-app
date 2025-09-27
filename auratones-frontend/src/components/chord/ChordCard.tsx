import React, { useRef } from "react";
import type { ChordEntry } from "../../types/chord";
import ChordDiagram from "./ChordDiagram";
import PianoDiagram from "./PianoDiagram";
import "../../styles/ChordCard.scss";

type Props = {
  chord: ChordEntry;
  onOpen: (chord: ChordEntry) => void;
};

export default function ChordCard({ chord, onOpen }: Props) {
  const name = chord.symbol;
  const total = chord.variants?.length ?? 0;

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

  // Piano demo cơ bản
  const pianoNotes = [0, 4, 7];

  return (
    <div
      ref={rootRef}
      className="chord-card"
      role="button"
      tabIndex={0}
      aria-label={`${name}. Nhấn Enter để mở chi tiết`}
      onClick={() => onOpen(chord)}
      onKeyDown={handleKey}
    >
      {/* Diagram preview */}
      <div className="thumb" aria-hidden>
        <div className="thumb__canvas">
          {chord.instrument !== "piano" ? (
            <ChordDiagram
              shape={{ ...chord.variants[0], name }}
              numStrings={chord.instrument === "guitar" ? 6 : 4}
              showName={false}
            />
          ) : (
            <PianoDiagram notes={pianoNotes} />
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="meta">
        <div className="title" title={name}>
          {name}
        </div>
        {total > 1 ? (
          <div className="voicing-badge">{total}</div>
        ) : (
          <div className="voicing-badge voicing--single" aria-hidden="true">
            &nbsp;
          </div>
        )}
      </div>
    </div>
  );
}
