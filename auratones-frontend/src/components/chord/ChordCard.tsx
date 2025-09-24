// src/components/chord/ChordCard.tsx
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
  // ví dụ Cmaj7 <-> CΔ
  if (notation === "symbol") return symbol.replace(/maj7/gi, "Δ");
  return symbol.replace(/Δ/gi, "maj7");
}

export default function ChordCard({ chord, onOpen, notation }: Props) {
  const name = formatName(chord.symbol, notation);

  return (
    <button className="chord-card" onClick={() => onOpen(chord)} aria-label={`Open ${name}`}>
      <div className="thumb">
        {chord.instrument !== "piano" ? (
          <ChordDiagram
            shape={{ ...chord.variants[0], name }}
            size={220}
            numStrings={chord.instrument === "guitar" ? 6 : 4}
            showName={false}
          />
        ) : (
          <PianoDiagram notes={[0, 4, 7]} label={name} /> /* placeholder */
        )}
      </div>
      <div className="title">{name}</div>
    </button>
  );
}
