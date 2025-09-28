import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../styles/ChordModal.scss";
import "../../styles/ChordEditorDialog.scss";
import ChordDiagram from "./ChordDiagram";
import type { Barre, ChordShape, Instrument } from "../../types/chord";

/** ===== Props ===== */
type Props = {
  isOpen: boolean;
  instrument: Instrument;
  initialSymbol?: string;
  isAdmin?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    instrument: Instrument;
    symbol: string;
    variants: ChordShape[];
    visibility: "system" | "private" | "contribute";
  }) => void;
};

/** ===== Consts ===== */
const FRET_MIN = 1;
const STRINGS_MAP: Record<Instrument, number> = {
  guitar: 6,
  ukulele: 4,
  piano: 88,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** ===== Editor Grid ===== */
const EditorGrid: React.FC<{
  instrument: Instrument;
  baseFret: number;
  frets: number[];
  setFrets: React.Dispatch<React.SetStateAction<number[]>>;
  barres: Barre[];
  setBarres: React.Dispatch<React.SetStateAction<Barre[]>>;
  fingers: (0 | 1 | 2 | 3 | 4)[];
  setFingers: React.Dispatch<React.SetStateAction<(0 | 1 | 2 | 3 | 4)[]>>;
  isAdmin: boolean;
  visibleFrets: 4 | 5;
}> = ({
  instrument,
  baseFret,
  frets,
  setFrets,
  barres,
  setBarres,
  fingers,
  setFingers,
  isAdmin,
  visibleFrets,
}) => {
  const nStrings = STRINGS_MAP[instrument];
  if (instrument === "piano") {
    return (
      <div className="editor-grid piano-note" style={{ padding: 16, opacity: 0.8 }}>
        Chỉnh sửa chord cho Piano sẽ được bổ sung sau.
      </div>
    );
  }

  /** chọn / bỏ-chọn một ô */
  const selectAt = useCallback(
    (row: number, fret: number) => {
      setFrets((prev) => {
        const next = prev.slice();
        const cur = next[row] ?? 0;

        if (!isAdmin) {
          const fingerUsed = fingers[row];
          if (fingerUsed > 1) {
            if (fingers.filter((f) => f === fingerUsed).length > 1) {
              (window as any).__toast?.(`Ngón ${fingerUsed} đã được dùng chỗ khác.`, "error");
              return prev;
            }
          }
        }

        // toggle: bấm lại → open
        next[row] = cur === fret ? 0 : fret;
        return next;
      });
    },
    [fingers, isAdmin, setFrets]
  );

  const setMute = (row: number) =>
    setFrets((prev) => {
      const n = prev.slice();
      n[row] = -1;
      return n;
    });

  const setOpen = (row: number) =>
    setFrets((prev) => {
      const n = prev.slice();
      n[row] = 0;
      return n;
    });

  /** Shift+drag để tạo barre */
  const dragRef = useRef<{ startRow: number; fret: number } | null>(null);
  const onCellMouseDown = (row: number, fret: number, e: React.MouseEvent) => {
    if (e.shiftKey) dragRef.current = { startRow: row, fret };
  };
  const onMouseUp = (row: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const from = Math.min(drag.startRow + 1, row + 1);
    const to = Math.max(drag.startRow + 1, row + 1);
    if (to - from >= 1) {
      const newBarre: Barre = { fret: drag.fret, from, to, finger: 1 };
      setBarres((prev) => [...prev.filter((b) => b.fret !== drag.fret), newBarre]);
    }
    dragRef.current = null;
  };

  const FRET_VISIBLE = visibleFrets;

  /** UI grid */
  return (
    <div
      className={`editor-grid fret-${FRET_VISIBLE}`}
      role="grid"
      style={
        {
          // dùng CSS variables cho SCSS
          ["--fret-cols" as any]: FRET_VISIBLE,
        } as React.CSSProperties
      }
    >
      <div className="row header">
        <div className="cell stub" />
        {Array.from({ length: FRET_VISIBLE }, (_, i) => (
          <div className="cell head" key={i}>
            {baseFret + i}
          </div>
        ))}
        <div className="cell stub" />
        <div className="finger-head">Ngón</div>
      </div>

      {Array.from({ length: nStrings }, (_, r) => {
        const cur = frets[r] ?? 0;
        return (
          <div className="row" key={r}>
            <button
              className={`cell side ${cur === -1 ? "active mute" : ""}`}
              onClick={() => setMute(r)}
              title="Mute (×)"
            >
              ×
            </button>
            {Array.from({ length: FRET_VISIBLE }, (_, c) => {
              const fret = baseFret + c;
              const isOn = cur === fret;
              const hasBarre = !!barres.find(
                (b) => b.fret === fret && r + 1 >= b.from && r + 1 <= b.to
              );
              return (
                <button
                  key={c}
                  className={`cell ${isOn ? "on" : ""} ${hasBarre ? "barre" : ""}`}
                  onClick={() => selectAt(r, fret)}
                  onMouseDown={(e) => onCellMouseDown(r, fret, e)}
                  onMouseUp={() => onMouseUp(r)}
                  title={isOn ? `Fret ${fret}` : "Chọn ô này"}
                >
                  {hasBarre ? "—" : isOn ? "●" : ""}
                </button>
              );
            })}
            <button
              className={`cell side ${cur === 0 ? "active open" : ""}`}
              onClick={() => setOpen(r)}
              title="Open (0)"
            >
              0
            </button>
            <div className="cell finger-cell" title="Chọn ngón tay cho nốt trên dây này">
              <select
                value={fingers[r]}
                onChange={(e) => {
                  const f = Number(e.target.value) as 0 | 1 | 2 | 3 | 4;
                  setFingers((prev) => {
                    const n = prev.slice();
                    n[r] = f;
                    return n;
                  });
                }}
                disabled={cur <= 0}
              >
                {[0, 1, 2, 3, 4].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}

      {barres.length > 0 && (
        <div className="barre-list">
          {barres.map((b, i) => (
            <div key={i} className="barre-item">
              <span className="barre-meta">
                Barre {b.from}-{b.to} @fret {b.fret}
              </span>
              <select
                value={b.finger}
                onChange={(e) => {
                  const f = Number(e.target.value) as 1 | 2 | 3 | 4;
                  setBarres((prev) => prev.map((bb, j) => (j === i ? { ...bb, finger: f } : bb)));
                }}
                title="Chọn ngón cho barre"
              >
                {[1, 2, 3, 4].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button
                className="barre-remove"
                onClick={() => setBarres((prev) => prev.filter((_, j) => j !== i))}
                title="Xóa barre"
              >
                <span className="icon" /> Xóa
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** ===== Dialog ===== */
const ChordEditorDialog: React.FC<Props> = ({
  isOpen,
  instrument,
  initialSymbol = "",
  isAdmin = false,
  onClose,
  onSubmit,
}) => {
  const nStrings = STRINGS_MAP[instrument];
  const [symbol, setSymbol] = useState(initialSymbol);
  const [baseFret, setBaseFret] = useState(1);
  const [frets, setFrets] = useState<number[]>(Array.from({ length: nStrings }, () => 0));
  const [fingers, setFingers] = useState<(0 | 1 | 2 | 3 | 4)[]>(
    Array.from({ length: nStrings }, () => 0)
  );
  const [barres, setBarres] = useState<Barre[]>([]);
  const [rootString, setRootString] = useState<number | null>(null);

  // 4 | 5 ngăn hiển thị
  const [visibleFrets, setVisibleFrets] = useState<4 | 5>(4);

  useEffect(() => {
    if (isOpen) {
      setSymbol(initialSymbol || "");
      setBaseFret(1);
      setFrets(Array.from({ length: nStrings }, () => 0));
      setFingers(Array.from({ length: nStrings }, () => 0));
      setBarres([]);
      setRootString(null);
      setVisibleFrets(4);
    }
  }, [isOpen, initialSymbol, nStrings]);

  const resetAll = () => {
    setSymbol(initialSymbol || "");
    setBaseFret(1);
    setFrets(Array.from({ length: nStrings }, () => 0));
    setFingers(Array.from({ length: nStrings }, () => 0));
    setBarres([]);
    setRootString(null);
    setVisibleFrets(4);
  };

  // calc root fret theo rootString + barre/note
  const rootFret = useMemo(() => {
    if (!rootString) return undefined;
    const idx = rootString - 1;
    const f = frets[idx];
    if (f > 0) return f; // nốt có ngón
    const barreHere = barres.find((b) => idx + 1 >= b.from && idx + 1 <= b.to);
    if (barreHere) return barreHere.fret;
    return undefined;
  }, [rootString, frets, barres]);

  const shape: ChordShape = useMemo(
    () => ({
      id: undefined,
      name: symbol.trim() || "Chord",
      baseFret,
      frets: frets.slice(),
      fingers: fingers.slice() as (0 | 1 | 2 | 3 | 4)[],
      rootString: rootString || undefined,
      rootFret: rootFret,
      barres: barres.length ? barres : undefined,
      gridFrets: visibleFrets,
    }),
    [symbol, baseFret, frets, fingers, barres, rootString, rootFret, visibleFrets]
  );

  const canSubmit = symbol.trim().length > 0;

  if (!isOpen) return null;
  return (
    <div className="chord-modal">
      <div className="backdrop" onClick={onClose} />
      <div className="panel" style={{ width: "75vw", maxWidth: 1400, padding: "20px" }}>
        <header>
          <div className="title">Soạn hợp âm</div>
          <button className="close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="editor-body editor-split">
          <div className="editor-controls">
            <label className="lbl">Ký hiệu hợp âm</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Ví dụ: C, Am, Cmaj7…"
            />

            <div className="basefret-stepper">
              <span className="bf-label">Base fret</span>
              <button
                className="bf-btn"
                onClick={() => setBaseFret((f) => clamp(f - 1, FRET_MIN, 24))}
                title="Giảm"
              >
                −
              </button>
              <input
                className="bf-value"
                value={baseFret}
                onChange={(e) =>
                  setBaseFret(e.target.value === "" ? 1 : clamp(parseInt(e.target.value, 10) || 1, 1, 24))
                }
                onBlur={(e) => {
                  if (e.target.value === "") setBaseFret(1);
                }}
              />
              <button
                className="bf-btn"
                onClick={() => setBaseFret((f) => clamp(f + 1, FRET_MIN, 24))}
                title="Tăng"
              >
                +
              </button>
              <button className="bf-auto" onClick={() => setBaseFret(1)}>
                Reset
              </button>
            </div>

            {/* chọn 4 hoặc 5 ngăn hiển thị */}
            <div className="basefret-stepper" title="Số ngăn hiển thị trên diagram">
              <span className="bf-label">Số ngăn</span>
              <select
                className="bf-value"
                value={visibleFrets}
                onChange={(e) => setVisibleFrets(Number(e.target.value) as 4 | 5)}
              >
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>

            <button className="bf-auto" onClick={resetAll}>
              Reset All
            </button>
          </div>

          <div className="editor-preview">
            <ChordDiagram
              shape={{ ...shape, name: symbol || "Chord" }}
              numStrings={instrument === "guitar" ? 6 : instrument === "ukulele" ? 4 : undefined}
              showName
            />
            <div className="root-select">
              <label className="root-label">
                Nốt gốc:
                <select
                  value={rootString ?? ""}
                  onChange={(e) => setRootString(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">(none)</option>
                  {Array.from({ length: nStrings }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Dây {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="editor-canvas">
            <EditorGrid
              instrument={instrument}
              baseFret={baseFret}
              frets={frets}
              setFrets={setFrets}
              barres={barres}
              setBarres={setBarres}
              fingers={fingers}
              setFingers={setFingers}
              isAdmin={isAdmin}
              visibleFrets={visibleFrets}
            />
          </div>
        </div>

        <footer className="editor-footer">
          <div className="editor-footer-note">
            Shift + kéo để barre. Admin bỏ qua mọi giới hạn. Chọn “Số ngăn” để hiển thị 4/5 ngăn.
          </div>
          <div>
            {!isAdmin ? (
              <>
                <button className="btn-secondary" onClick={onClose}>
                  Hủy
                </button>
                <button
                  className="btn-primary"
                  disabled={!canSubmit}
                  onClick={() => {
                    const json = { instrument, symbol, variants: [shape], visibility: "contribute" as const };
                    console.log("[contribute chord]", json);
                    onSubmit(json);
                  }}
                >
                  Gửi đóng góp
                </button>
              </>
            ) : (
              <>
                <button className="btn-secondary" onClick={onClose}>
                  Hủy
                </button>
                <button
                  className="btn-primary"
                  disabled={!canSubmit}
                  onClick={() => onSubmit({ instrument, symbol, variants: [shape], visibility: "system" })}
                >
                  Bổ sung vào hệ thống
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ChordEditorDialog;
