import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../styles/ChordVoicingDialog.scss";
import Toast from "../Toast";
import { useToast } from "../../hooks/useToast";
import type { Barre, ChordShape, Instrument } from "../../types/chord";

type Props = {
  isOpen: boolean;
  instrument: Instrument; // initial instrument từ ChordPage / Canonical
  symbol: string;
  onClose: () => void;
  onSubmit: (payload: { instrument: Instrument; symbol: string; variants: ChordShape[] }) => void;
  onBack?: () => void;
};

const STRINGS_MAP: Record<Instrument, number> = { guitar: 6, ukulele: 4, piano: 88 };
const FRET_MIN = 1;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const INSTRUMENT_OPTIONS: Instrument[] = ["guitar", "ukulele", "piano"];

/** ===== EditorGrid giữ nguyên ===== */
const EditorGrid: React.FC<{
  instrument: Instrument;
  baseFret: number;
  frets: number[];
  setFrets: React.Dispatch<React.SetStateAction<number[]>>;
  barres: Barre[];
  setBarres: React.Dispatch<React.SetStateAction<Barre[]>>;
  fingers: (0 | 1 | 2 | 3 | 4)[];
  setFingers: React.Dispatch<React.SetStateAction<(0 | 1 | 2 | 3 | 4)[]>>;
  visibleFrets: 4 | 5;
}> = ({ instrument, baseFret, frets, setFrets, barres, setBarres, fingers, setFingers, visibleFrets }) => {
  const nStrings = STRINGS_MAP[instrument];
  if (instrument === "piano") {
    return <div className="editor-grid piano-note" style={{ padding: 0, opacity: 0.8 }}>
      Chỉnh sửa chord cho Piano sẽ được bổ sung sau.
    </div>;
  }

  const selectAt = useCallback((row: number, fret: number) => {
    setFrets((prev) => {
      const next = prev.slice();
      const cur = next[row] ?? 0;
      next[row] = cur === fret ? 0 : fret;
      return next;
    });
  }, [setFrets]);

  const setMute = (row: number) => setFrets((prev) => { const n = prev.slice(); n[row] = -1; return n; });
  const setOpen = (row: number) => setFrets((prev) => { const n = prev.slice(); n[row] = 0;  return n; });

  const dragRef = useRef<{ startRow: number; fret: number } | null>(null);
  const onCellMouseDown = (row: number, fret: number, e: React.MouseEvent) => { if (e.shiftKey) dragRef.current = { startRow: row, fret }; };
  const onMouseUp = (row: number) => {
    const drag = dragRef.current; if (!drag) return;
    const from = Math.min(drag.startRow + 1, row + 1);
    const to = Math.max(drag.startRow + 1, row + 1);
    if (to - from >= 1) {
      const newBarre: Barre = { fret: drag.fret, from, to, finger: 1 };
      setBarres((prev) => [...prev.filter((b) => b.fret !== drag.fret), newBarre]);
    }
    dragRef.current = null;
  };

  const FRET_VISIBLE = visibleFrets;

  const fingerAt = useCallback((row: number, fret: number): number | null => {
    const barreHere = barres.find((b) => b.fret === fret && row + 1 >= b.from && row + 1 <= b.to);
    if (barreHere?.finger) return barreHere.finger;
    const cur = frets[row] ?? 0;
    if (cur === fret && (fingers[row] ?? 0) > 0) return fingers[row];
    return null;
  }, [barres, frets, fingers]);

  return (
    <div className={`editor-grid fret-${FRET_VISIBLE}`} role="grid" style={{ ["--fret-cols" as any]: FRET_VISIBLE } as React.CSSProperties}>
      <div className="row header">
        <div className="cell stub" />
        {Array.from({ length: FRET_VISIBLE }, (_, i) => <div className="cell head" key={i}>{baseFret + i}</div>)}
        <div className="cell stub" />
        <div className="finger-head">Ngón</div>
      </div>

      {Array.from({ length: nStrings }, (_, r) => {
        const cur = frets[r] ?? 0;
        return (
          <div className="row" key={r}>
            <button className={`cell side ${cur === -1 ? "active mute" : ""}`} onClick={() => setMute(r)} title="Mute (×)">×</button>
            {Array.from({ length: FRET_VISIBLE }, (_, c) => {
              const fret = baseFret + c;
              const isOn = cur === fret;
              const hasBarre = !!barres.find((b) => b.fret === fret && r + 1 >= b.from && r + 1 <= b.to);
              const fingerNum = fingerAt(r, fret);
              return (
                <button
                  key={c}
                  className={`cell ${isOn ? "on" : ""} ${hasBarre ? "barre" : ""} ${fingerNum ? "has-finger" : ""}`}
                  onClick={() => selectAt(r, fret)}
                  onMouseDown={(e) => onCellMouseDown(r, fret, e)}
                  onMouseUp={() => onMouseUp(r)}
                  title={fingerNum ? `Fret ${fret} • Ngón ${fingerNum}${hasBarre ? " (barre)" : ""}` : (isOn ? `Fret ${fret}` : "Chọn ô này")}
                >
                  {hasBarre ? "—" : isOn ? "●" : ""}
                  {fingerNum && <span className="finger-badge" aria-hidden>{fingerNum}</span>}
                </button>
              );
            })}
            <button className={`cell side ${cur === 0 ? "active open" : ""}`} onClick={() => setOpen(r)} title="Open (0)">0</button>
            <div className="cell finger-cell" title="Chọn ngón tay cho nốt trên dây này">
              <select
                value={fingers[r]}
                onChange={(e) => {
                  const f = Number(e.target.value) as 0 | 1 | 2 | 3 | 4;
                  setFingers((prev) => { const n = prev.slice(); n[r] = f; return n; });
                }}
                disabled={cur <= 0}
              >
                {[0,1,2,3,4].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ChordVoicingDialog: React.FC<Props> = ({ isOpen, instrument, symbol, onClose, onSubmit, onBack }) => {
  const { message, type, showToast, hideToast } = useToast();

  useEffect(() => {
    (window as any).__toast = (msg: string, t?: 'success'|'error'|'info') => showToast(msg, t);
    return () => { (window as any).__toast = undefined; };
  }, [showToast]);

  // ⬇️ selector nhạc cụ TẠI VOICING
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument>(instrument);
  const nStrings = STRINGS_MAP[selectedInstrument];

  useEffect(() => {
    if (!isOpen) return;
    setSelectedInstrument(instrument); // reset theo initial khi mở
  }, [isOpen, instrument]);

  const [baseFret, setBaseFret] = useState(1);
  const [frets, setFrets] = useState<number[]>(Array.from({ length: nStrings }, () => 0));
  const [fingers, setFingers] = useState<(0 | 1 | 2 | 3 | 4)[]>(Array.from({ length: nStrings }, () => 0));
  const [barres, setBarres] = useState<Barre[]>([]);
  const [rootString, setRootString] = useState<number | null>(null);
  const [visibleFrets, setVisibleFrets] = useState<4 | 5>(4);

  // reset frets/fingers khi số dây thay đổi theo nhạc cụ
  useEffect(() => {
    setFrets(Array.from({ length: nStrings }, () => 0));
    setFingers(Array.from({ length: nStrings }, () => 0));
    setBarres([]);
    setRootString(null);
    setVisibleFrets(4);
    setBaseFret(1);
  }, [nStrings]);

  const rootFret = useMemo(() => {
    if (!rootString) return undefined;
    const idx = rootString - 1;
    const f = frets[idx];
    if (f > 0) return f;
    const barreHere = barres.find((b) => idx + 1 >= b.from && idx + 1 <= b.to);
    if (barreHere) return barreHere.fret;
    return undefined;
  }, [rootString, frets, barres]);

  const shape: ChordShape = useMemo(() => ({
    id: undefined, name: symbol || "Chord", baseFret,
    frets: frets.slice(),
    fingers: fingers.slice() as (0 | 1 | 2 | 3 | 4)[],
    rootString: rootString || undefined, rootFret,
    barres: barres.length ? barres : undefined,
    gridFrets: visibleFrets,
  }), [baseFret, frets, fingers, barres, rootString, rootFret, visibleFrets, symbol]);

  if (!isOpen) return null;

  return (
    <>
      <div className="chord-modal">
        <div className="backdrop" onClick={onClose} />
        <div className="panel chord-panel">
          <header>
            <div className="title">Chỉnh voicing — {symbol}</div>
            <button className="close" onClick={onClose}>×</button>
          </header>

          <div className="voicing-body card">
            {/* Nhạc cụ */}
            <div className="voicing-controls">
              <label className="lbl" htmlFor="voicing-ins">Nhạc cụ</label>
              <select
                id="voicing-ins"
                value={selectedInstrument}
                onChange={(e) => setSelectedInstrument(e.target.value as Instrument)}
                aria-label="Instrument"
              >
                {INSTRUMENT_OPTIONS.map((ins) => <option key={ins} value={ins}>{ins}</option>)}
              </select>
            </div>

            {/* Grid editor */}
            <EditorGrid
              instrument={selectedInstrument}
              baseFret={baseFret}
              frets={frets}
              setFrets={setFrets}
              barres={barres}
              setBarres={setBarres}
              fingers={fingers}
              setFingers={setFingers}
              visibleFrets={visibleFrets}
            />

            <div className="voicing-toolbar">
              <div className="bf-group">
                <span className="bf-label">Base fret</span>
                <button className="bf-btn" onClick={() => setBaseFret((f) => clamp(f - 1, FRET_MIN, 24))}>−</button>
                <input
                  className="bf-value"
                  value={baseFret}
                  onChange={(e) =>
                    setBaseFret(e.target.value === "" ? 1 : clamp(parseInt(e.target.value, 10) || 1, 1, 24))
                  }
                  onBlur={(e) => { if (e.target.value === "") setBaseFret(1); }}
                />
                <button className="bf-btn" onClick={() => setBaseFret((f) => clamp(f + 1, FRET_MIN, 24))}>+</button>
                <button className="bf-ghost" onClick={() => setBaseFret(1)}>Reset</button>
              </div>

              <div className="bf-group" title="Số ngăn hiển thị trên diagram">
                <span className="bf-label">Số ngăn</span>
                <select className="bf-value" value={visibleFrets} onChange={(e) => setVisibleFrets(Number(e.target.value) as 4 | 5)}>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
                <button
                  className="bf-ghost"
                  onClick={() => {
                    setFrets(Array.from({ length: nStrings }, () => 0));
                    setFingers(Array.from({ length: nStrings }, () => 0));
                    setBarres([]);
                    setRootString(null);
                    setVisibleFrets(4);
                  }}
                >
                  Reset Voicing
                </button>
              </div>

              {selectedInstrument !== "piano" && (
                <div className="bf-group">
                  <span className="bf-label">Nốt gốc (dây)</span>
                  <select
                    className="bf-value"
                    value={rootString ?? ""}
                    onChange={(e) => setRootString(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">(none)</option>
                    {Array.from({ length: nStrings }, (_, i) => (
                      <option key={i + 1} value={i + 1}>Dây {i + 1}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <footer className="editor-footer">
            <div>
              <button className="btn-secondary" onClick={onBack}>Quay lại</button>
              <button className="btn-secondary" onClick={onClose}>Hủy</button>
            <div className="editor-footer-note">Shift + kéo để barre.</div>
              <button
                className="btn-primary"
                onClick={() => {
                  const hasAnyNote = (frets.some((f) => f > 0) || barres.length > 0);
                  if (!hasAnyNote) {
                    (window as any).__toast?.("Voicing rỗng: đặt ít nhất 1 nốt hoặc barre.", "error");
                    return;
                  }
                  onSubmit({ instrument: selectedInstrument, symbol, variants: [shape] });
                }}
              >
                Lưu voicing
              </button>
            </div>
          </footer>
        </div>
      </div>

      <Toast message={message} type={type} onClose={hideToast} />
    </>
  );
};

export default ChordVoicingDialog;
