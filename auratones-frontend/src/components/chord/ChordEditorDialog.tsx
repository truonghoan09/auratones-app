import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../styles/ChordModal.scss";
import "../../styles/ChordEditorDialog.scss";
import ChordDiagram from "./ChordDiagram";
import type { Barre, ChordShape, Instrument } from "../../types/chord";

/** ===== Types ===== */
type CanonicalPayload = {
  pc: number;                  // 0..11
  recipeId: string;            // ví dụ: "major","m7","7b9","13#11",...
  bassPc?: number;             // cho slash/inversion (optional)
  bassRole?: "3rd" | "5th" | "b7" | "other";
};

type SubmitPayloadCompat = {
  instrument: Instrument;
  symbol: string;              // preview label (fallback), vẫn giữ tương thích
  variants: ChordShape[];      // voicings; có thể [] (theo yêu cầu)
  visibility: "system" | "private" | "contribute";
  // ===== mới: canonical tách bạch =====
  canonical: CanonicalPayload;
};

type Props = {
  isOpen: boolean;
  instrument: Instrument;
  initialSymbol?: string;        // giữ để không phá vỡ, nay chỉ làm “placeholder”
  isAdmin?: boolean;
  onClose: () => void;
  onSubmit: (payload: SubmitPayloadCompat) => void; // giữ signature ổn định + bổ sung canonical
};

/** ===== Pitch helpers (FE-only) ===== */
const SHARP = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
const FLAT  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"] as const;
const PC = (x: number) => ((x % 12) + 12) % 12;

function pcToLabel(pc: number, prefer: "sharp"|"flat" = "sharp") {
  return (prefer === "flat" ? FLAT : SHARP)[PC(pc)];
}

/** ===== Recipe list (editor choices) =====
 * Giữ gọn & đồng bộ với BE; có thể mở rộng sau
 */
const RECIPE_OPTIONS: { id: string; label: string }[] = [
  // triads
  { id: "major", label: "major" },
  { id: "minor", label: "minor" },
  { id: "dim",   label: "dim"   },
  { id: "aug",   label: "aug"   },

  // 6 / add9 / sus
  { id: "6",       label: "6" },
  { id: "m6",      label: "m6" },
  { id: "add9",    label: "add9" },
  { id: "m_add9",  label: "m(add9)" },
  { id: "sus2",    label: "sus2" },
  { id: "sus4",    label: "sus4" },

  // sevenths
  { id: "7",    label: "7 (dominant)" },
  { id: "maj7", label: "maj7" },
  { id: "m7",   label: "m7" },
  { id: "m7b5", label: "m7b5" },
  { id: "dim7", label: "dim7" },

  // 9 / 11 / 13
  { id: "9",       label: "9" },
  { id: "m9",      label: "m9" },
  { id: "maj9",    label: "maj9" },
  { id: "11",      label: "11" },
  { id: "sus4add9",label: "sus4add9" },
  { id: "13",      label: "13" },
  { id: "m13",     label: "m13" },

  // altered dom
  { id: "7b9",   label: "7b9" },
  { id: "7#9",   label: "7#9" },
  { id: "7b5",   label: "7b5" },
  { id: "7#5",   label: "7#5" },
  { id: "9b5",   label: "9b5" },
  { id: "9#5",   label: "9#5" },
  { id: "13b9",  label: "13b9" },
  { id: "13#11", label: "13#11" },
  { id: "7#11",  label: "7#11" },
];

/** suffix cho preview symbol */
const RECIPE_SUFFIX: Record<string, string> = {
  major: "", minor: "m", dim: "dim", aug: "aug",
  "6":"6", m6:"m6", add9:"add9", m_add9:"m(add9)", sus2:"sus2", sus4:"sus4",
  "7":"7", maj7:"maj7", m7:"m7", m7b5:"m7b5", dim7:"dim7",
  "9":"9", m9:"m9", maj9:"maj9", "11":"11", sus4add9:"sus4add9", "13":"13", m13:"m13",
  "7b9":"7b9", "7#9":"7#9", "7b5":"7b5", "7#5":"7#5", "9b5":"9b5", "9#5":"9#5", "13b9":"13b9", "13#11":"13#11", "7#11":"7#11",
};

/** ===== Guitar editor constants (giữ nguyên) ===== */
const FRET_MIN = 1;
const STRINGS_MAP: Record<Instrument, number> = {
  guitar: 6,
  ukulele: 4,
  piano: 88,
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** ===== Editor Grid (giữ nguyên logic soạn voicing) ===== */
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

        next[row] = cur === fret ? 0 : fret; // toggle
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

  // Shift+drag → barre
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

  return (
    <div
      className={`editor-grid fret-${FRET_VISIBLE}`}
      role="grid"
      style={{ ["--fret-cols" as any]: FRET_VISIBLE } as React.CSSProperties}
    >
      <div className="row header">
        <div className="cell stub" />
        {Array.from({ length: FRET_VISIBLE }, (_, i) => (
          <div className="cell head" key={i}>{baseFret + i}</div>
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

  /** ===== Canonical state ===== */
  const [rootPc, setRootPc] = useState<number>(0); // C
  const [recipeId, setRecipeId] = useState<string>("major");
  const [useSlash, setUseSlash] = useState<boolean>(false);
  const [bassPc, setBassPc] = useState<number | undefined>(undefined);
  const [bassRole, setBassRole] = useState<"3rd"|"5th"|"b7"|"other" | undefined>(undefined);

  /** ===== Voicing state (giữ nguyên logic) ===== */
  const [baseFret, setBaseFret] = useState(1);
  const [frets, setFrets] = useState<number[]>(Array.from({ length: nStrings }, () => 0));
  const [fingers, setFingers] = useState<(0 | 1 | 2 | 3 | 4)[]>(
    Array.from({ length: nStrings }, () => 0)
  );
  const [barres, setBarres] = useState<Barre[]>([]);
  const [rootString, setRootString] = useState<number | null>(null);
  const [visibleFrets, setVisibleFrets] = useState<4 | 5>(4);

  /** include voicing when submit? (mặc định tắt theo yêu cầu) */
  const [includeVoicing, setIncludeVoicing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // reset
    setRootPc(0);
    setRecipeId("major");
    setUseSlash(false);
    setBassPc(undefined);
    setBassRole(undefined);

    setBaseFret(1);
    setFrets(Array.from({ length: nStrings }, () => 0));
    setFingers(Array.from({ length: nStrings }, () => 0));
    setBarres([]);
    setRootString(null);
    setVisibleFrets(4);

    setIncludeVoicing(false);
  }, [isOpen, nStrings]);

  /** calc rootFret theo rootString */
  const rootFret = useMemo(() => {
    if (!rootString) return undefined;
    const idx = rootString - 1;
    const f = frets[idx];
    if (f > 0) return f;
    const barreHere = barres.find((b) => idx + 1 >= b.from && idx + 1 <= b.to);
    if (barreHere) return barreHere.fret;
    return undefined;
  }, [rootString, frets, barres]);

  /** current voicing shape (preview) */
  const shape: ChordShape = useMemo(
    () => ({
      id: undefined,
      name: "Chord",
      baseFret,
      frets: frets.slice(),
      fingers: fingers.slice() as (0 | 1 | 2 | 3 | 4)[],
      rootString: rootString || undefined,
      rootFret: rootFret,
      barres: barres.length ? barres : undefined,
      gridFrets: visibleFrets,
    }),
    [baseFret, frets, fingers, barres, rootString, rootFret, visibleFrets]
  );

  /** preview symbol từ canonical (để hiển thị/tương thích) */
  const symbolPreview = useMemo(() => {
    const rootLabel = pcToLabel(rootPc, "sharp");
    const suffix = RECIPE_SUFFIX[recipeId] ?? `(${recipeId})`;
    const base = `${rootLabel}${suffix}`;
    if (useSlash && typeof bassPc === "number") {
      return `${base}/${pcToLabel(bassPc, "sharp")}`;
    }
    return base;
  }, [rootPc, recipeId, useSlash, bassPc]);

  /** quick-set bassRole → bassPc */
  const handleSetBassRole = (role: "3rd" | "5th" | "b7" | "other") => {
    setBassRole(role);
    let offset = 0;
    if (role === "3rd") {
      // hỗ trợ cả maj3 và min3 — ở level editor này ta không phân biệt theo recipe, FE chỉ gợi ý
      // chọn mặc định maj3; nếu là m/ m7 sẽ vẫn hợp lệ vì bassPc chỉ là pc
      offset = 4; // maj3
      if (/^m(?!aj)/.test(recipeId)) offset = 3; // nếu m... thì ưu tiên b3
    } else if (role === "5th") {
      offset = 7;
    } else if (role === "b7") {
      offset = 10;
    } else {
      // other → giữ nguyên (user sẽ chọn bassPc thủ công)
      return;
    }
    setUseSlash(true);
    setBassPc(PC(rootPc + offset));
  };

  const canSubmit = useMemo(() => {
    return recipeId && typeof rootPc === "number";
  }, [recipeId, rootPc]);

  if (!isOpen) return null;
  return (
    <div className="chord-modal">
      <div className="backdrop" onClick={onClose} />
      <div className="panel" style={{ width: "75vw", maxWidth: 1400, padding: "20px" }}>
        <header>
          <div className="title">Soạn hợp âm</div>
          <button className="close" onClick={onClose}>×</button>
        </header>

        <div className="editor-body editor-split">
          {/* ===== Canonical controls ===== */}
          <div className="editor-controls">
            <label className="lbl">Root (pc)</label>
            <select
              value={rootPc}
              onChange={(e) => setRootPc(Number(e.target.value))}
              aria-label="Root"
            >
              {SHARP.map((n, pc) => (
                <option key={pc} value={pc}>{n}</option>
              ))}
            </select>

            <label className="lbl">Loại hợp âm (recipeId)</label>
            <select
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              aria-label="Recipe"
            >
              {RECIPE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>

            <div className="slash-block">
              <label className="lbl">Slash / Inversion</label>
              <div className="row-inline">
                <label className="chk">
                  <input
                    type="checkbox"
                    checked={useSlash}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setUseSlash(v);
                      if (!v) { setBassPc(undefined); setBassRole(undefined); }
                    }}
                  />
                  Dùng slash
                </label>
                <button className="bf-auto" onClick={() => handleSetBassRole("3rd")}>Bass = 3rd</button>
                <button className="bf-auto" onClick={() => handleSetBassRole("5th")}>Bass = 5th</button>
                <button className="bf-auto" onClick={() => handleSetBassRole("b7")}>Bass = b7</button>
              </div>

              <div className="row-inline" aria-disabled={!useSlash}>
                <select
                  disabled={!useSlash}
                  value={typeof bassPc === "number" ? bassPc : ""}
                  onChange={(e) =>
                    setBassPc(e.target.value === "" ? undefined : Number(e.target.value))
                  }
                  aria-label="Bass note (pc)"
                >
                  <option value="">(auto/none)</option>
                  {SHARP.map((n, pc) => (
                    <option key={pc} value={pc}>{n}</option>
                  ))}
                </select>

                <select
                  disabled={!useSlash}
                  value={bassRole ?? ""}
                  onChange={(e) =>
                    setBassRole((e.target.value || undefined) as any)
                  }
                  aria-label="Bass role"
                >
                  <option value="">(no role)</option>
                  <option value="3rd">3rd</option>
                  <option value="5th">5th</option>
                  <option value="b7">b7</option>
                  <option value="other">other</option>
                </select>
              </div>
            </div>

            <div className="preview-line" style={{ marginTop: 8 }}>
              <span className="bf-label">Preview:</span>
              <code style={{ fontWeight: 700, marginLeft: 6 }}>{symbolPreview}</code>
            </div>

            <div className="basefret-stepper" style={{ marginTop: 16 }}>
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
              <button className="bf-auto" onClick={() => setBaseFret(1)}>Reset</button>
            </div>

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

            <div className="row-inline" style={{ marginTop: 8 }}>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={includeVoicing}
                  onChange={(e) => setIncludeVoicing(e.target.checked)}
                />
                Gửi kèm voicing này
              </label>
            </div>

            <button
              className="bf-auto"
              style={{ marginTop: 8 }}
              onClick={() => {
                // reset voicing nhanh
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

          {/* ===== Preview + chọn rootString ===== */}
          <div className="editor-preview">
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
                      <option key={i + 1} value={i + 1}>
                        Dây {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* ===== Canvas soạn voicing ===== */}
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
            Shift + kéo để barre. Admin bỏ qua mọi giới hạn. “Gửi kèm voicing này” mặc định tắt (chỉ gửi canonical).
          </div>
          <div>
            <button className="btn-secondary" onClick={onClose}>Hủy</button>
            <button
              className="btn-primary"
              disabled={!canSubmit}
              onClick={() => {
                const canonical: CanonicalPayload = {
                  pc: rootPc,
                  recipeId,
                  ...(useSlash && typeof bassPc === "number" ? { bassPc } : {}),
                  ...(useSlash && bassRole ? { bassRole } : {}),
                };

                const payload: SubmitPayloadCompat = {
                  instrument,
                  symbol: symbolPreview,               // giữ tương thích cho UI cũ
                  variants: includeVoicing ? [shape] : [],
                  visibility: isAdmin ? "system" : "contribute",
                  canonical,
                };

                onSubmit(payload);
              }}
            >
              {isAdmin ? "Bổ sung vào hệ thống" : "Gửi"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ChordEditorDialog;
