import React from "react";
import type { ChordEntry } from "../../types/chord";
import ChordDiagram from "./ChordDiagram";
import PianoDiagram from "./PianoDiagram";
import "../../styles/ChordCard.scss";

type Props = {
  chord: ChordEntry;
  onOpen: (chord: ChordEntry) => void;
  notation: "long" | "symbol";
};

function formatName(symbol: string, notation: "long" | "symbol") {
  if (notation === "symbol") return symbol.replace(/maj7/gi, "Δ");
  return symbol.replace(/Δ/gi, "maj7");
}

export default function ChordCard({ chord, onOpen, notation }: Props) {
  const name = formatName(chord.symbol, notation);

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(chord);
    }
  };

  return (
    <div
      className="chord-card"
      role="button"
      tabIndex={0}
      aria-label={`Open ${name}`}
      onClick={() => onOpen(chord)}
      onKeyDown={handleKey}
    >
      {/* HÀNG 1–8: vùng chứa SVG */}
      <div className="thumb" aria-hidden>
        <div className="thumb__canvas">
          {chord.instrument !== "piano" ? (
            <ChordDiagram
              shape={{ ...chord.variants[0], name }}
              size={920} // base; thật ra SVG fill theo CSS
              numStrings={chord.instrument === "guitar" ? 6 : 4}
              showName={false}
            />
          ) : (
            <PianoDiagram notes={[0, 4, 7]} label={name} />
          )}
        </div>
      </div>

      {/* HÀNG 9: tên hợp âm */}
      <div className="title" title={name}>
        {name}
      </div>
    </div>
  );
}
