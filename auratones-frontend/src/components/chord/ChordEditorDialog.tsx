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
const FRET_VISIBLE = 5;
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
}> = ({ instrument, baseFret, frets, setFrets, barres, setBarres, fingers, setFingers, isAdmin }) => {
  const nStrings = STRINGS_MAP[instrument];
  if (instrument === "piano") {
    return (
      <div className="editor-grid piano-note" style={{ padding: 16, opacity: 0.8 }}>
        Chỉnh sửa chord cho Piano sẽ được bổ sung sau.
      </div>
    );
  }

  /** chọn / bỏ-chọn một ô */
  const selectAt = useCallback((row: number, fret: number) => {
    setFrets(prev => {
      const next = prev.slice();
      const cur = next[row] ?? 0;

      // Nếu không phải admin thì enforce rule
      if (!isAdmin) {
        const fingerUsed = fingers[row];
        if (fingerUsed > 1) {
          // ngón 2,3,4 chỉ có thể xuất hiện 1 lần
          if (fingers.filter(f => f === fingerUsed).length > 1) {
            (window as any).__toast?.(`Ngón ${fingerUsed} đã được dùng chỗ khác.`, "error");
            return prev;
          }
        }
      }

      // toggle: bấm lại ô đang chọn → open
      if (cur === fret) {
        next[row] = 0;
      } else {
        next[row] = fret;
      }
      return next;
    });
  }, [fingers, isAdmin, setFrets]);

  const setMute = (row: number) => setFrets(prev => { const n = prev.slice(); n[row] = -1; return n; });
  const setOpen = (row: number) => setFrets(prev => { const n = prev.slice(); n[row] = 0; return n; });

  /** Shift+drag để tạo barre */
  const dragRef = useRef<{ startRow: number; fret: number } | null>(null);
  const onCellMouseDown = (row: number, fret: number, e: React.MouseEvent) => { if (e.shiftKey) dragRef.current = { startRow: row, fret }; };
  const onMouseUp = (row: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const from = Math.min(drag.startRow + 1, row + 1);
    const to = Math.max(drag.startRow + 1, row + 1);
    if (to - from >= 1) {
      const newBarre: Barre = { fret: drag.fret, from, to, finger: 1 };
      setBarres(prev => [...prev.filter(b => b.fret !== drag.fret), newBarre]);
    }
    dragRef.current = null;
  };

  /** UI grid */
  return (
    <div className="editor-grid" role="grid">
      <div className="row header">
        <div className="cell stub" />
        {Array.from({ length: FRET_VISIBLE }, (_, i) => (
          <div className="cell head" key={i}>{baseFret + i}</div>
        ))}
        <div className="cell stub" />
      </div>

      {Array.from({ length: nStrings }, (_, r) => {
        const cur = frets[r] ?? 0;
        return (
          <div className="row" key={r}>
            <button className={`cell side ${cur === -1 ? "active mute" : ""}`} onClick={() => setMute(r)}>×</button>
            {Array.from({ length: FRET_VISIBLE }, (_, c) => {
              const fret = baseFret + c;
              const isOn = cur === fret;
              const hasBarre = !!barres.find(b => b.fret === fret && r+1 >= b.from && r+1 <= b.to);
              return (
                <button
                  key={c}
                  className={`cell ${isOn ? "on" : ""} ${hasBarre ? "barre" : ""}`}
                  onClick={() => selectAt(r, fret)}
                  onMouseDown={(e) => onCellMouseDown(r, fret, e)}
                  onMouseUp={() => onMouseUp(r)}
                >
                  {hasBarre ? "—" : isOn ? "●" : ""}
                </button>
              );
            })}
            <button className={`cell side ${cur === 0 ? "active open" : ""}`} onClick={() => setOpen(r)}>0</button>
          </div>
        );
      })}

      {/* danh sách barre để chỉnh/xóa */}
      {barres.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {barres.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span>Barre {b.from}-{b.to} @fret {b.fret}</span>
              <select value={b.finger} onChange={(e) => {
                const f = Number(e.target.value) as 1|2|3|4;
                setBarres(prev => prev.map((bb,j) => j===i ? {...bb,finger:f} : bb));
              }}>
                {[1,2,3,4].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <button onClick={() => setBarres(prev => prev.filter((_,j) => j!==i))}>Xóa</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** ===== Dialog ===== */
const ChordEditorDialog: React.FC<Props> = ({ isOpen, instrument, initialSymbol = "", isAdmin = false, onClose, onSubmit }) => {
  const nStrings = STRINGS_MAP[instrument];
  const [symbol, setSymbol] = useState(initialSymbol);
  const [baseFret, setBaseFret] = useState(1);
  const [frets, setFrets] = useState<number[]>(Array.from({ length: nStrings }, () => 0));
  const [fingers, setFingers] = useState<(0|1|2|3|4)[]>(Array.from({ length: nStrings }, () => 0));
  const [barres, setBarres] = useState<Barre[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSymbol(initialSymbol || "");
      setBaseFret(1);
      setFrets(Array.from({ length: nStrings }, () => 0));
      setFingers(Array.from({ length: nStrings }, () => 0));
      setBarres([]);
    }
  }, [isOpen, initialSymbol, nStrings]);

  const resetAll = () => {
    setSymbol(initialSymbol || "");
    setBaseFret(1);
    setFrets(Array.from({ length: nStrings }, () => 0));
    setFingers(Array.from({ length: nStrings }, () => 0));
    setBarres([]);
  };

  const shape: ChordShape = useMemo(() => ({
    id: undefined,
    name: symbol.trim() || "Chord",
    baseFret,
    frets: frets.slice(),
    fingers: fingers.slice(),
    rootString: undefined,
    barres: barres.length ? barres : undefined,
  }), [symbol, baseFret, frets, fingers, barres]);

  const canSubmit = symbol.trim().length > 0;

  if (!isOpen) return null;
  return (
    <div className="chord-modal">
      <div className="backdrop" onClick={onClose} />
      <div className="panel" style={{ width:"75vw",maxWidth:1400,padding:"20px" }}>
        <header>
          <div className="title">Soạn hợp âm</div>
          <button className="close" onClick={onClose}>×</button>
        </header>

        <div className="editor-body editor-split">
          <div className="editor-controls">
            <label className="lbl">Ký hiệu hợp âm</label>
            <input value={symbol} onChange={(e)=>setSymbol(e.target.value)} placeholder="Ví dụ: C, Am, Cmaj7…" />
            <div className="basefret-stepper">
              <span className="bf-label">Base fret</span>
              <button className="bf-btn" onClick={()=>setBaseFret(f=>clamp(f-1,1,24))}>−</button>
              <input
                className="bf-value"
                value={baseFret}
                onChange={(e)=>setBaseFret(e.target.value===""?1:clamp(parseInt(e.target.value,10)||1,1,24))}
                onBlur={(e)=>{ if(e.target.value==="") setBaseFret(1); }}
              />
              <button className="bf-btn" onClick={()=>setBaseFret(f=>clamp(f+1,1,24))}>+</button>
              <button className="bf-auto" onClick={()=>setBaseFret(1)}>Reset</button>
            </div>
            <button className="bf-auto" onClick={resetAll}>Reset All</button>
          </div>

          <div className="editor-preview">
            <ChordDiagram shape={{...shape,name:symbol||"Chord"}} numStrings={instrument==="guitar"?6:instrument==="ukulele"?4:undefined} showName />
          </div>

          <div className="editor-canvas">
            <EditorGrid instrument={instrument} baseFret={baseFret} frets={frets} setFrets={setFrets} barres={barres} setBarres={setBarres} fingers={fingers} setFingers={setFingers} isAdmin={isAdmin}/>
          </div>
        </div>

        <footer className="editor-footer">
          <div className="editor-footer-note">Shift + kéo để barre. Alt để gán ngón nhanh. Admin bỏ qua mọi giới hạn.</div>
          <div>
            {!isAdmin ? (
              <>
                <button className="btn-secondary" onClick={onClose}>Hủy</button>
                <button className="btn-primary" disabled={!canSubmit} onClick={()=>onSubmit({instrument,symbol,variants:[shape],visibility:"private"})}>Lưu riêng tư</button>
                <button className="btn-primary" disabled={!canSubmit} onClick={()=>onSubmit({instrument,symbol,variants:[shape],visibility:"contribute"})}>Gửi đóng góp</button>
              </>
            ) : (
              <>
                <button className="btn-secondary" onClick={onClose}>Hủy</button>
                <button className="btn-primary" disabled={!canSubmit} onClick={()=>onSubmit({instrument,symbol,variants:[shape],visibility:"system"})}>Bổ sung vào hệ thống</button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ChordEditorDialog;
