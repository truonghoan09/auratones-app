import React, { useEffect, useRef, useState, useMemo } from "react";
import type { ChordEntry } from "../../types/chord";
import ChordDiagram from "./ChordDiagram";
import PianoDiagram from "./PianoDiagram";
import "../../styles/ChordModal.scss";

type Props = {
  chord: ChordEntry | null;
  onClose: () => void;
  isAdmin?: boolean;
  onEditVoicing?: (payload: { chord: ChordEntry; variantIndex: number }) => void;
  onDeleteVoicing?: (payload: { chord: ChordEntry; variantIndex: number }) => void;
};

export default function ChordModal({
  chord,
  onClose,
  isAdmin,
  onEditVoicing,
  onDeleteVoicing,
}: Props) {
  // ----- Hooks ở trước mọi early-return -----
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
    let startX = 0, dx = 0, active = false;

    const onStart = (e: TouchEvent | MouseEvent) => {
      active = true;
      startX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      dx = 0;
    };
    const onMove = (e: TouchEvent | MouseEvent) => {
      if (!active) return;
      const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      dx = x - startX;
      (el as HTMLElement).style.setProperty("--offset", `${dx}px`);
      el.classList.add("dragging");
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      el.classList.remove("dragging");
      (el as HTMLElement).style.removeProperty("--offset");
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

  // Phát hiện admin (trước early-return để không đổi thứ tự hooks)
  const admin = useMemo(() => {
    if (typeof isAdmin === "boolean") return isAdmin;
    try {
      const w = window as any;
      if (w?.__auth?.role === "admin") return true;
      if (w?.__user?.role === "admin") return true;
      const stored = localStorage.getItem("role");
      if (stored && stored.toLowerCase() === "admin") return true;
    } catch {}
    return false;
  }, [isAdmin]);

  // Early return SAU hooks
  if (!chord) return null;

  const name = chord.symbol;
  const isPiano = chord.instrument === "piano";
  const count = chord.variants.length;

  const canEdit = Boolean(onEditVoicing);
  const canDelete = Boolean(onDeleteVoicing);

  return (
    <div className="chord-modal" role="dialog" aria-modal="true">
      <div className="backdrop" onClick={onClose} />
      <div className="panel" ref={containerRef}>
        <header>
          <div className="title">{name}</div>

          {/* Admin actions */}
          {admin && (
            <div className="admin-actions" aria-label="Admin actions">
              <button
                className="icon-btn edit-btn"
                onClick={() => onEditVoicing?.({ chord, variantIndex: index })}
                disabled={!canEdit}
                aria-label="Edit voicing"
                title={canEdit ? "Edit voicing này" : "Chưa cấu hình onEditVoicing"}
              >
                {/* Pencil icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" viewBox="0 0 16 16">
                  <path fill="currentColor" d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/>
                </svg>
                <span className="lbl">Edit</span>
              </button>

              <button
                className="icon-btn danger delete-btn"
                onClick={() => onDeleteVoicing?.({ chord, variantIndex: index })}
                disabled={!canDelete}
                aria-label="Delete voicing"
                title={canDelete ? "Delete voicing này" : "Chưa cấu hình onDeleteVoicing"}
              >
                {/* Trash icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" viewBox="0 0 16 16">
                  <path fill="currentColor" d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
                </svg>
                <span className="lbl">Delete</span>
              </button>
            </div>
          )}

          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="viewer">
          <div className="carousel" style={{ "--index": index } as React.CSSProperties}>
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
            onClick={() => setIndex((i) => Math.min(count - 1, i + 1))}
          >
            →
          </button>
        </footer>
      </div>
    </div>
  );
}
