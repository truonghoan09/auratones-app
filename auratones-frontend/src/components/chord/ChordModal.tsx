import React, { useEffect, useRef, useState } from "react";
import type { ChordEntry } from "../../types/chord";
import ChordDiagram from "./ChordDiagram";
import PianoDiagram from "./PianoDiagram";
import "../../styles/ChordModal.scss";

type Props = {
  chord: ChordEntry | null;
  onClose: () => void;
};

export default function ChordModal({ chord, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(0);
  }, [chord]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!chord) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setIndex((i) => Math.min(chord.variants.length - 1, i + 1));
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [chord, onClose]);

  // Swipe gesture
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startX = 0,
      dx = 0,
      active = false;

    const onStart = (e: TouchEvent | MouseEvent) => {
      active = true;
      startX = "touches" in e ? e.touches[0].clientX : e.clientX;
      dx = 0;
    };
    const onMove = (e: TouchEvent | MouseEvent) => {
      if (!active) return;
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      dx = x - startX;
      el.style.setProperty("--offset", `${dx}px`);
      el.classList.add("dragging");
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      el.classList.remove("dragging");
      el.style.removeProperty("--offset");
      if (!chord) return;

      if (dx < -60 && index < chord.variants.length - 1) setIndex(index + 1);
      else if (dx > 60 && index > 0) setIndex(index - 1);
    };

    el.addEventListener("mousedown", onStart);
    el.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);

    return () => {
      el.removeEventListener("mousedown", onStart);
      el.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [index, chord]);

  if (!chord) return null;
  const name = chord.symbol;
  const isPiano = chord.instrument === "piano";
  const count = chord.variants.length;

  return (
    <div className="chord-modal" role="dialog" aria-modal="true">
      <div className="backdrop" onClick={onClose} />
      <div className="panel" ref={containerRef}>
        <header>
          <div className="title">{name}</div>
          <button className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="viewer">
          <div
            className="carousel"
            style={{ "--index": index } as React.CSSProperties}
          >
            {chord.variants.map((v, i) => (
              <div className="slide" key={v.id ?? i}>
                {!isPiano ? (
                  <ChordDiagram
                    shape={{ ...v, name }}
                    numStrings={chord.instrument === "guitar" ? 6 : 4}
                    showName={false}
                  />
                ) : (
                  <PianoDiagram notes={[0, 4, 7]} />
                )}
              </div>
            ))}
          </div>
        </div>

        <footer>
          <button
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            ←
          </button>
          <div className="pager">
            {index + 1} / {count}
          </div>
          <button
            disabled={index === count - 1}
            onClick={() =>
              setIndex((i) => Math.min(count - 1, i + 1))
            }
          >
            →
          </button>
        </footer>
      </div>
    </div>
  );
}
