import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../styles/ChordModal.scss";
import "../../styles/ChordEditorDialog.scss";
import ChordDiagram from "./ChordDiagram";
import type { Barre, ChordShape, Instrument } from "../../types/chord";
import Toast from "../Toast";
import { useToast } from "../../hooks/useToast";

/** ===== Types ===== */
type CanonicalPayload = {
  pc: number;       // 0..11
  recipeId: string; // "major","m7","7b9","13#11",...
  bassPc?: number;  // slash/inversion (optional)
};

type SubmitPayloadCompat = {
  instrument: Instrument;
  symbol: string;
  variants: ChordShape[];
  visibility: "system" | "private" | "contribute";
  canonical: CanonicalPayload;
  meta?: {
    intent: "ADD_VOICING_CANONICAL" | "UPSERT_SLASH_AND_OPTIONAL_VOICING";
    isSlash: boolean;
    recipeCode: string;      // maj, m, 7...
    canonicalIdHint: string; // r{pc}__{recipeCode}[_b{bassPc}]
  };
};

type Props = {
  isOpen: boolean;
  instrument: Instrument;
  initialSymbol?: string;
  isAdmin?: boolean;
  onClose: () => void;
  onSubmit: (payload: SubmitPayloadCompat) => void;
};

/** ===== Pitch helpers (FE-only) ===== */
const SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
const FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"] as const;
const PC = (x: number) => ((x % 12) + 12) % 12;
function pcToLabel(pc: number, prefer: "sharp"|"flat" = "sharp") {
  return (prefer === "flat" ? FLAT : SHARP)[PC(pc)];
}

/** ===== Recipe list ===== */
const RECIPE_OPTIONS: { id: string; label: string }[] = [
  { id: "major", label: "major" }, { id: "minor", label: "minor" },
  { id: "dim", label: "dim" }, { id: "aug", label: "aug" },
  { id: "6", label: "6" }, { id: "m6", label: "m6" },
  { id: "add9", label: "add9" }, { id: "m_add9", label: "m(add9)" },
  { id: "sus2", label: "sus2" }, { id: "sus4", label: "sus4" },
  { id: "7", label: "7 (dominant)" }, { id: "maj7", label: "maj7" },
  { id: "m7", label: "m7" }, { id: "m7b5", label: "m7b5" }, { id: "dim7", label: "dim7" },
  { id: "9", label: "9" }, { id: "m9", label: "m9" }, { id: "maj9", label: "maj9" },
  { id: "11", label: "11" }, { id: "sus4add9", label: "sus4add9" },
  { id: "13", label: "13" }, { id: "m13", label: "m13" },
  { id: "7b9", label: "7b9" }, { id: "7#9", label: "7#9" },
  { id: "7b5", label: "7b5" }, { id: "7#5", label: "7#5" },
  { id: "9b5", label: "9b5" }, { id: "9#5", label: "9#5" },
  { id: "13b9", label: "13b9" }, { id: "13#11", label: "13#11" }, { id: "7#11", label: "7#11" },
];

const RECIPE_SUFFIX: Record<string, string> = {
  major:"", minor:"m", dim:"dim", aug:"aug", "6":"6", m6:"m6", add9:"add9", m_add9:"m(add9)",
  sus2:"sus2", sus4:"sus4", "7":"7", maj7:"maj7", m7:"m7", m7b5:"m7b5", dim7:"dim7",
  "9":"9", m9:"m9", maj9:"maj9", "11":"11", sus4add9:"sus4add9", "13":"13", m13:"m13",
  "7b9":"7b9","7#9":"7#9","7b5":"7b5","7#5":"7#5","9b5":"9b5","9#5":"9#5","13b9":"13b9","13#11":"13#11","7#11":"7#11",
};

/** Chuẩn hoá recipe FE → code canonical */
const RECIPE_NORMALIZE: Record<string, string> = { major:"maj", minor:"m", dim:"dim", aug:"aug" };
const normalizeRecipeId = (id: string) => RECIPE_NORMALIZE[id] ?? id;

const FRET_MIN = 1;
const STRINGS_MAP: Record<Instrument, number> = { guitar: 6, ukulele: 4, piano: 88 };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** ===== Editor Grid (giữ cấu trúc cũ) ===== */
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
  instrument, baseFret, frets, setFrets, barres, setBarres, fingers, setFingers, isAdmin, visibleFrets,
}) => {
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
      if (!isAdmin) {
        const fingerUsed = fingers[row];
        if (fingerUsed > 1 && fingers.filter((f) => f === fingerUsed).length > 1) {
          (window as any).__toast?.(`Ngón ${fingerUsed} đã được dùng chỗ khác.`, "error");
          return prev;
        }
      }
      next[row] = cur === fret ? 0 : fret;
      return next;
    });
  }, [fingers, isAdmin, setFrets]);

  const setMute = (row: number) => setFrets((prev) => { const n = prev.slice(); n[row] = -1; return n; });
  const setOpen = (row: number) => setFrets((prev) => { const n = prev.slice(); n[row] = 0;  return n; });

  // Shift+drag → barre
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

      {barres.length > 0 && (
        <div className="barre-list">
          {barres.map((b, i) => (
            <div key={i} className="barre-item">
              <span className="barre-meta">Barre {b.from}-{b.to} @fret {b.fret}</span>
              <select
                value={b.finger}
                onChange={(e) => {
                  const f = Number(e.target.value) as 1 | 2 | 3 | 4;
                  setBarres((prev) => prev.map((bb, j) => (j === i ? { ...bb, finger: f } : bb)));
                }}
                title="Chọn ngón cho barre"
              >
                {[1,2,3,4].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <button className="barre-remove" onClick={() => setBarres((prev) => prev.filter((_, j) => j !== i))} title="Xóa barre">
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
  isOpen, instrument, initialSymbol = "", isAdmin = false, onClose, onSubmit,
}) => {
  const nStrings = STRINGS_MAP[instrument];
  const { message, type, showToast, hideToast } = useToast();

  useEffect(() => {
    (window as any).__toast = (msg: string, t?: 'success'|'error'|'info') => showToast(msg, t);
    return () => { (window as any).__toast = undefined; };
  }, [showToast]);

  /** ===== Canonical state ===== */
  const [rootPc, setRootPc] = useState<number>(0);
  const [recipeId, setRecipeId] = useState<string>("major");
  const [useSlash, setUseSlash] = useState<boolean>(false);
  const [bassPc, setBassPc] = useState<number | undefined>(undefined);

  /** ===== Voicing state ===== */
  const [baseFret, setBaseFret] = useState(1);
  const [frets, setFrets] = useState<number[]>(Array.from({ length: nStrings }, () => 0));
  const [fingers, setFingers] = useState<(0 | 1 | 2 | 3 | 4)[]>(Array.from({ length: nStrings }, () => 0));
  const [barres, setBarres] = useState<Barre[]>([]);
  const [rootString, setRootString] = useState<number | null>(null);
  const [visibleFrets, setVisibleFrets] = useState<4 | 5>(4);
  const [includeVoicing, setIncludeVoicing] = useState(false);

  /** ===== Highlight states ===== */
  const [controlsInvalid, setControlsInvalid] = useState(false);
  const [canvasInvalid, setCanvasInvalid] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRootPc(0); setRecipeId("major"); setUseSlash(false); setBassPc(undefined);
    setBaseFret(1); setFrets(Array.from({ length: nStrings }, () => 0));
    setFingers(Array.from({ length: nStrings }, () => 0)); setBarres([]);
    setRootString(null); setVisibleFrets(4);
    setIncludeVoicing(false); setControlsInvalid(false); setCanvasInvalid(false);
  }, [isOpen, nStrings]);

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
    id: undefined, name: "Chord", baseFret, frets: frets.slice(),
    fingers: fingers.slice() as (0 | 1 | 2 | 3 | 4)[],
    rootString: rootString || undefined, rootFret, barres: barres.length ? barres : undefined, gridFrets: visibleFrets,
  }), [baseFret, frets, fingers, barres, rootString, rootFret, visibleFrets]);

  const symbolPreview = useMemo(() => {
    const rootLabel = pcToLabel(rootPc, "sharp");
    const suffix = RECIPE_SUFFIX[recipeId] ?? `(${recipeId})`;
    const base = `${rootLabel}${suffix}`;
    if (useSlash && typeof bassPc === "number") return `${base}/${pcToLabel(bassPc, "sharp")}`;
    return base;
  }, [rootPc, recipeId, useSlash, bassPc]);

  const validate = () => {
    const errors: string[] = [];
    let controlsBad = false, canvasBad = false;
    if (rootPc === null || rootPc === undefined) { errors.push("Vui lòng chọn Nốt gốc."); controlsBad = true; }
    if (!recipeId) { errors.push("Vui lòng chọn Phân loại hợp âm."); controlsBad = true; }
    if (includeVoicing) {
      const hasAnyNote = (frets.some((f) => f > 0) || barres.length > 0);
      if (!hasAnyNote) { errors.push("Voicing rỗng: đặt ít nhất 1 nốt hoặc barre, hoặc tắt 'Gửi kèm voicing'."); canvasBad = true; }
    }
    setControlsInvalid(controlsBad); setCanvasInvalid(canvasBad);
    return { ok: errors.length === 0, errors };
  };

  const canSubmit = useMemo(() => recipeId && typeof rootPc === "number", [recipeId, rootPc]);

  if (!isOpen) return null;

  return (
    <>
      <div className="chord-modal">
        <div className="backdrop" onClick={onClose} />
        <div className="panel chord-panel">
          <header>
            <div className="title">Soạn hợp âm</div>
            <button className="close" onClick={onClose}>×</button>
          </header>

          {/* ====== BODY (90vh container → 1/3 info | 2/3 nhập liệu khi có voicing) ====== */}
          <div className={`editor-body editor-split ${includeVoicing ? "has-voicing" : ""}`}>
            {/* ===== Header controls (INFO) — 2 cột × 2 hàng ===== */}
            <div className={`editor-controls card ${controlsInvalid ? "invalid" : ""}`}>
              <div className="ctrl-grid">
                {/* Block 1: Root + (optional) slash bass | 2 dòng */}
                <div className="ctrl-block block-1">
                  <div className="blocksmall">
                    <label className="lbl">Nốt gốc</label>
                    <div className="root-with-slash">
                      <select
                        className={!Number.isInteger(rootPc) ? "select-invalid" : ""}
                        value={rootPc}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setRootPc(v);
                          if (typeof bassPc === "number" && bassPc === v) setBassPc(undefined);
                        }}
                        aria-label="Root"
                      >
                        {SHARP.map((n, pc) => <option key={pc} value={pc}>{n}</option>)}
                      </select>

                      {useSlash && (
                        <>
                          <span className="slash-sep" aria-hidden>/</span>
                          <select
                            value={typeof bassPc === "number" ? bassPc : ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") return setBassPc(undefined);
                              const num = Number(val);
                              setBassPc(Number.isNaN(num) ? undefined : num);
                            }}
                            aria-label="Bass (đảo)"
                            title="Nốt bass cho hợp âm đảo (để -- nếu không dùng)"
                          >
                            <option value="">{`--`}</option>
                            {SHARP.map((n, pc) => pc === rootPc ? null : <option key={pc} value={pc}>{n}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="blocksmall">
                    <label className="lbl">Phân loại</label>
                    <div>
                      <select
                        className={!recipeId ? "select-invalid" : ""}
                        value={recipeId}
                        onChange={(e) => setRecipeId(e.target.value)}
                        aria-label="Recipe"
                      >
                        {RECIPE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Block 2: Toggle Đảo bass */}
                <div className="ctrl-block block-2">
                  <button
                    type="button"
                    className={`toggle ${useSlash ? "is-on" : ""}`}
                    aria-pressed={useSlash}
                    onClick={() => { const next = !useSlash; setUseSlash(next); if (!next) setBassPc(undefined); }}
                    title="Bật/tắt hợp âm đảo bass"
                  >
                    {useSlash ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="bi bi-toggle-on" viewBox="0 0 16 16">
                        <path d="M5 3a5 5 0 0 0 0 10h6a5 5 0 0 0 0-10zm6 9a4 4 0 1 1 0-8 4 4 0 0 1 0 8"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="bi bi-toggle-off" viewBox="0 0 16 16">
                        <path d="M11 4a4 4 0 0 1 0 8H8a5 5 0 0 0 2-4 5 5 0 0 0-2-4zm-6 8a4 4 0 1 1 0-8 4 4 0 0 1 0 8M0 8a5 5 0 0 0 5 5h6a5 5 0 0 0 0-10H5a5 5 0 0 0-5 5"/>
                      </svg>
                    )}
                    <span>Đảo bass</span>
                  </button>
                </div>

                {/* Block 3: Tên hợp âm */}
                <div className="ctrl-block block-3">
                  <label className="lbl">Tên hợp âm</label>
                  <code className="preview-code">{symbolPreview}</code>
                </div>

                {/* Block 4: Toggle Gửi kèm voicing */}
                <div className="ctrl-block block-4">
                  <button
                    type="button"
                    className={`toggle ${includeVoicing ? "is-on" : ""}`}
                    aria-pressed={includeVoicing}
                    onClick={() => setIncludeVoicing((v) => !v)}
                    title="Gửi kèm voicing trong payload"
                  >
                    {includeVoicing ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="bi bi-toggle-on" viewBox="0 0 16 16">
                        <path d="M5 3a5 5 0 0 0 0 10h6a5 5 0 0 0 0-10zm6 9a4 4 0 1 1 0-8 4 4 0 0 1 0 8"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="bi bi-toggle-off" viewBox="0 0 16 16">
                        <path d="M11 4a4 4 0 0 1 0 8H8a5 5 0 0 0 2-4 5 5 0 0 0-2-4zm-6 8a4 4 0 1 1 0-8 4 4 0 0 1 0 8M0 8a5 5 0 0 0 5 5h6a5 5 0 0 0 0-10H5a5 5 0 0 0-5 5"/>
                      </svg>
                    )}
                    <span>Gửi kèm voicing</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ===== INPUT AREA (2/3) — Preview trái (1/3) + Canvas phải (2/3) ===== */}
            {includeVoicing && (
              <div className="editor-input">
                <div className={`editor-preview card ${canvasInvalid ? "invalid" : ""}`}>
                  <ChordDiagram
                    shape={{ ...shape, name: symbolPreview || "Chord" }}
                    numStrings={instrument === "guitar" ? 6 : instrument === "ukulele" ? 4 : undefined}
                    showName
                  />
                  {instrument !== "piano" && (
                    <div className="root-select">
                      <label className="root-label">
                        Nốt gốc (trên dây):
                        <select
                          value={rootString ?? ""}
                          onChange={(e) => setRootString(e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">(none)</option>
                          {Array.from({ length: nStrings }, (_, i) => (
                            <option key={i + 1} value={i + 1}>Dây {i + 1}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>

                <div className={`editor-canvas card ${canvasInvalid ? "invalid" : ""}`}>
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
                  </div>
                </div>
              </div>
            )}
          </div>

          <footer className="editor-footer">
            <div className="editor-footer-note">
              Shift + kéo để barre. Admin bỏ qua mọi giới hạn. “Gửi kèm voicing” mặc định tắt (chỉ gửi canonical).
            </div>
            <div>
              <button className="btn-secondary" onClick={onClose}>Hủy</button>
              <button
                className="btn-primary"
                disabled={!canSubmit}
                onClick={() => {
                  const { ok, errors } = validate();
                  if (!ok) { showToast(errors[0], "error"); return; }
                  const recipeCode = normalizeRecipeId(recipeId);
                  const baseCanonical = `r${rootPc}__${recipeCode}`;
                  const isSlash = !!(useSlash && typeof bassPc === "number");
                  const canonicalIdHint = isSlash ? `${baseCanonical}_b${bassPc}` : baseCanonical;

                  const canonical: CanonicalPayload = { pc: rootPc, recipeId, ...(isSlash ? { bassPc } : {}) };
                  const meta = {
                    intent: (isSlash ? "UPSERT_SLASH_AND_OPTIONAL_VOICING" : "ADD_VOICING_CANONICAL") as SubmitPayloadCompat["meta"]["intent"],
                    isSlash, recipeCode, canonicalIdHint,
                  };

                  const payload: SubmitPayloadCompat = {
                    instrument, symbol: symbolPreview, variants: includeVoicing ? [shape] : [],
                    visibility: isAdmin ? "system" : "contribute", canonical, meta,
                  };

                  console.log("[ChordEditor] READY payload →", payload);
                  showToast("Dữ liệu đã sẵn sàng để gửi!", "success");
                  onSubmit(payload);
                }}
              >
                {isAdmin ? "Bổ sung vào hệ thống" : "Gửi"}
              </button>
            </div>
          </footer>
        </div>
      </div>

      <Toast message={message} type={type} onClose={hideToast} />
    </>
  );
};

export default ChordEditorDialog;
