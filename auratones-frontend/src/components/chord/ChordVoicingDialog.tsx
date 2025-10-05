import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../styles/ChordVoicingDialog.scss";
import Toast from "../Toast";
import { useToast } from "../../hooks/useToast";
import type { Barre, ChordShape, Instrument } from "../../types/chord";
import ChordDiagram from "./ChordDiagram";

type Props = {
  isOpen: boolean;
  instrument: Instrument;
  symbol: string;
  onClose: () => void;
  onSubmit: (payload: { instrument: Instrument; symbol: string; variants: ChordShape[] }) => void;
  onBack?: () => void;
};

const STRINGS_MAP: Record<Instrument, number> = { guitar: 6, ukulele: 4, piano: 88 };
const FRET_MIN = 1;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const INSTRUMENT_OPTIONS: Instrument[] = ["guitar", "ukulele", "piano"];

/** Helper: set of rows (0-based) cần cảnh báo chọn ngón */
type DangerSet = Set<number>;

const FitBox: React.FC<{ origin?: "tl" | "br"; className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => {
  return (
    <div className={`fitbox ${className ?? ""}`}>
      <div className="fitbox-inner">{children}</div>
    </div>
  );
};

/** ===== EditorGrid (hiện số ở ô “chặn”, bỏ dấu gạch) ===== */
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
  /** hàng nào đang thiếu chọn ngón -> viền danger cho select */
  dangerRows?: DangerSet;
}> = ({
  instrument,
  baseFret,
  frets,
  setFrets,
  barres,
  setBarres,
  fingers,
  setFingers,
  visibleFrets,
  dangerRows,
}) => {
  const nStrings = STRINGS_MAP[instrument];
  if (instrument === "piano") {
    return (
      <div className="editor-grid piano-note" style={{ padding: 0, opacity: 0.8 }}>
        Chỉnh sửa chord cho Piano sẽ được bổ sung sau.
      </div>
    );
  }

  // --- helpers về “chặn” ---
  const highestBarreAtString = useCallback(
    (stringIdx1: number) => {
      let maxFret = 0;
      for (const b of barres) {
        if (stringIdx1 >= b.from && stringIdx1 <= b.to) {
          if (b.fret > maxFret) maxFret = b.fret;
        }
      }
      return maxFret; // 0 = không có chặn
    },
    [barres]
  );

  const effectiveFretForString = useCallback(
    (row: number) => {
      const cur = frets[row] ?? 0;
      if (cur === -1) return -1; // mute ưu tiên tuyệt đối
      const string1 = row + 1;
      const barreFret = highestBarreAtString(string1);
      // Luật: lấy ngăn cao hơn giữa nốt đơn và chặn (nếu có)
      return Math.max(cur, barreFret);
    },
    [frets, highestBarreAtString]
  );

  const hasBarreCovering = useCallback(
    (row: number, fret: number) => {
      const s1 = row + 1;
      return barres.some((b) => b.fret === fret && s1 >= b.from && s1 <= b.to);
    },
    [barres]
  );

  const barreFingerAt = useCallback(
    (row: number, fret: number): number | 0 => {
      const s1 = row + 1;
      const hit = barres.find((b) => b.fret === fret && s1 >= b.from && s1 <= b.to);
      return hit?.finger ?? 0;
    },
    [barres]
  );

  // --- thao tác chuột ---
  const selectAt = useCallback(
    (row: number, fret: number) => {
      setFrets((prev) => {
        const next = prev.slice();
        const cur = next[row] ?? 0;
        next[row] = cur === fret ? 0 : fret;
        return next;
      });
    },
    [setFrets]
  );

  // 🔧 Toggle Mute — nếu đang mute (-1) thì bấm nữa chuyển về Open (0), ngược lại set mute
  const setMute = (row: number) =>
    setFrets((prev) => {
      const n = prev.slice();
      n[row] = n[row] === -1 ? 0 : -1;
      return n;
    });

  const setOpen = (row: number) =>
    setFrets((prev) => {
      const n = prev.slice();
      n[row] = 0;
      return n;
    });

  // Shift + kéo để tạo “chặn”
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
      // mỗi ngăn chỉ giữ 1 “chặn”
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
          <div className="cell head" key={i}>
            {baseFret + i}
          </div>
        ))}
        <div className="cell stub" />
        <div className="finger-head">Ngón</div>
      </div>

      {Array.from({ length: nStrings }, (_, r) => {
        const eff = effectiveFretForString(r); // hiển thị theo luật chặn/ngón cao hơn
        const cur = frets[r] ?? 0; // raw
        const isOpenAllowed = eff === 0; // có chặn phủ thì không còn open
        const isDanger = dangerRows?.has(r);

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
              const cellHasBarre = hasBarreCovering(r, fret);
              const isOn = eff === fret;
              const showDirectFingerNum = isOn && cur === fret && (fingers[r] ?? 0) > 0 ? fingers[r] : 0;
              const showBarreFingerNum = cellHasBarre ? barreFingerAt(r, fret) : 0;

              return (
                <button
                  key={c}
                  className={`cell ${isOn ? "on" : ""} ${cellHasBarre ? "barre" : ""} ${
                    showDirectFingerNum ? "has-finger" : ""
                  }`}
                  onClick={() => selectAt(r, fret)}
                  onMouseDown={(e) => onCellMouseDown(r, fret, e)}
                  onMouseUp={() => onMouseUp(r)}
                  title={
                    showDirectFingerNum
                      ? `Fret ${fret} • Ngón ${showDirectFingerNum}${cellHasBarre ? " (chặn)" : ""}`
                      : isOn
                      ? `Fret ${fret}${cellHasBarre ? " (chặn)" : ""}`
                      : "Chọn ô này"
                  }
                >
                  {cellHasBarre
                    ? showBarreFingerNum
                      ? String(showBarreFingerNum)
                      : ""
                    : isOn
                    ? showDirectFingerNum
                      ? String(showDirectFingerNum)
                      : "●"
                    : ""}
                </button>
              );
            })}

            {/* Nút Open luôn click được để bỏ mute */}
            <button
              className={`cell side ${isOpenAllowed && cur === 0 ? "active open" : ""}`}
              onClick={() => setOpen(r)}
              title="Open (0)"
            >
              0
            </button>

            <div
              className={`cell finger-cell ${isDanger ? "danger" : ""}`}
              title="Chọn ngón tay cho nốt trên dây này"
            >
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
                // chỉ cho chọn ngón khi nốt trực tiếp > 0 (không tính “chặn”)
                disabled={!(cur > 0)}
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
    </div>
  );
};

const ChordVoicingDialog: React.FC<Props> = ({ isOpen, instrument, symbol, onClose, onSubmit, onBack }) => {
  const { message, type, showToast, hideToast } = useToast();

  useEffect(() => {
    (window as any).__toast = (msg: string, t?: "success" | "error" | "info") => showToast(msg, t);
    return () => {
      (window as any).__toast = undefined;
    };
  }, [showToast]);

  const [selectedInstrument, setSelectedInstrument] = useState<Instrument>(instrument);
  const nStrings = STRINGS_MAP[selectedInstrument];

  useEffect(() => {
    if (isOpen) setSelectedInstrument(instrument);
  }, [isOpen, instrument]);

  const [baseFret, setBaseFret] = useState(1);
  const [frets, setFrets] = useState<number[]>(Array.from({ length: nStrings }, () => 0));
  const [fingers, setFingers] = useState<(0 | 1 | 2 | 3 | 4)[]>(Array.from({ length: nStrings }, () => 0));
  const [barres, setBarres] = useState<Barre[]>([]);
  const [rootString, setRootString] = useState<number | null>(null);
  const [visibleFrets, setVisibleFrets] = useState<4 | 5>(4);

  // hàng cần viền danger cho select
  const [dangerRows, setDangerRows] = useState<DangerSet>(new Set());

  useEffect(() => {
    setFrets(Array.from({ length: nStrings }, () => 0));
    setFingers(Array.from({ length: nStrings }, () => 0));
    setBarres([]);
    setRootString(null);
    setVisibleFrets(4);
    setBaseFret(1);
    setDangerRows(new Set());
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

  const shape: ChordShape = useMemo(
    () => ({
      id: undefined,
      name: symbol || "Chord",
      baseFret,
      frets: frets.slice(),
      fingers: fingers.slice() as (0 | 1 | 2 | 3 | 4)[],
      rootString: rootString || undefined,
      rootFret,
      barres: barres.length ? barres : undefined,
      gridFrets: visibleFrets,
    }),
    [baseFret, frets, fingers, barres, rootString, rootFret, visibleFrets, symbol]
  );

  // cập nhật / xóa “chặn”
  const updateBarre = (idx: number, patch: Partial<Barre>) => {
    setBarres((prev) => {
      const next = prev.slice();
      const t = { ...next[idx], ...patch } as Barre;
      const lo = Math.max(1, Math.min(nStrings, Math.min(t.from, t.to)));
      const hi = Math.max(1, Math.min(nStrings, Math.max(t.from, t.to)));
      t.from = lo;
      t.to = hi;
      next[idx] = t;
      return next;
    });
  };
  const removeBarre = (idx: number) => setBarres((prev) => prev.filter((_, i) => i !== idx));

  const resetVoicing = () => {
    setFrets(Array.from({ length: nStrings }, () => 0));
    setFingers(Array.from({ length: nStrings }, () => 0));
    setBarres([]);
    setRootString(null);
    setVisibleFrets(4);
    setBaseFret(1);
    setDangerRows(new Set());
  };

  /** ====== Validation: thiếu ngón cho nốt đơn (cur > 0) ====== */
  const computeDangerRows = useCallback((): DangerSet => {
    const rows = new Set<number>();
    for (let r = 0; r < nStrings; r++) {
      const cur = frets[r] ?? 0; // chỉ xét nốt trực tiếp
      if (cur > 0 && (fingers[r] ?? 0) === 0) rows.add(r);
    }
    return rows;
  }, [frets, fingers, nStrings]);

  // Tự bỏ cảnh báo khi người dùng chọn/đổi ngón hoặc đổi nốt
  useEffect(() => {
    const rows = computeDangerRows();
    setDangerRows(rows);
  }, [computeDangerRows]);

  // Kiểm tra “chặn” có finger hợp lệ (1..4)
  const hasValidBarres = useMemo(() => {
    return barres.every((b) => b.finger && b.finger >= 1 && b.finger <= 4);
  }, [barres]);

  if (!isOpen) return null;

  return (
    <>
      <div className="chord-modal">
        <div className="backdrop" onClick={onClose} />
        <div className="panel chord-panel">
          <header>
            <div className="title">Chỉnh voicing — {symbol}</div>
            <button className="close" onClick={onClose}>
              ×
            </button>
          </header>

          <div className="voicing-body card voicing-layout">
            {/* LEFT (EditorGrid) + Barre list (mới) + auto-scale */}
            <section className="left-pane" aria-label="Vùng nhập voicing">
              <FitBox origin="tl" className="fitbox-editor">
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
                  dangerRows={dangerRows}
                />
              </FitBox>

              {/* == Barre list chuyển sang bên trái, ngay dưới editor == */}
              {barres.length > 0 && (
                <div className="barre-list" role="region" aria-label="Các chặn">
                  {barres.map((b, i) => (
                    <div key={`barre-row-${b.fret}-${i}`} className="barre-row">
                      <span className="tag">Chặn • Ngăn {b.fret}</span>
                      <label className="mini">
                        Từ dây
                        <select value={b.to} onChange={(e) => updateBarre(i, { to: Number(e.target.value) })}>
                          {Array.from({ length: nStrings }, (_, s) => s + 1).map((s) => (
                            <option key={`to-${s}`} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mini">
                        Đến dây
                        <select value={b.from} onChange={(e) => updateBarre(i, { from: Number(e.target.value) })}>
                          {Array.from({ length: nStrings }, (_, s) => s + 1).map((s) => (
                            <option key={`from-${s}`} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mini">
                        Ngón
                        <select
                          value={b.finger ?? 1}
                          onChange={(e) => updateBarre(i, { finger: Number(e.target.value) as 1 | 2 | 3 | 4 })}
                        >
                          {[1, 2, 3, 4].map((f) => (
                            <option key={`finger-${f}`} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="btn-danger-outline" onClick={() => removeBarre(i)}>
                        Xóa chặn
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* RIGHT: controls + preview (auto-scale) */}
            <aside className="right-pane">
              <div className="controls-pane" aria-label="Tùy chọn nhạc cụ & tham số hiển thị">
                <div className="voicing-controls">
                  <label className="lbl" htmlFor="voicing-ins">
                    Nhạc cụ
                  </label>
                  <select
                    id="voicing-ins"
                    value={selectedInstrument}
                    onChange={(e) => setSelectedInstrument(e.target.value as Instrument)}
                    aria-label="Instrument"
                  >
                    {INSTRUMENT_OPTIONS.map((ins) => (
                      <option key={ins} value={ins}>
                        {ins.charAt(0).toUpperCase() + ins.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bf-group bf-stepper basefret-group">
                  <span className="bf-label">Base fret</span>
                  <button className="bf-btn" onClick={() => setBaseFret((f) => clamp(f - 1, FRET_MIN, 24))}>
                    −
                  </button>
                  <input
                    className="bf-value num"
                    value={baseFret}
                    onChange={(e) =>
                      setBaseFret(e.target.value === "" ? 1 : clamp(parseInt(e.target.value, 10) || 1, 1, 24))
                    }
                    onBlur={(e) => {
                      if (e.target.value === "") setBaseFret(1);
                    }}
                  />
                  <button className="bf-btn" onClick={() => setBaseFret((f) => clamp(f + 1, FRET_MIN, 24))}>
                    +
                  </button>
                  <button className="bf-ghost" onClick={resetVoicing}>
                    Reset
                  </button>
                </div>

                <div className="bf-group bf-stepper">
                  <span className="bf-label">Số ngăn</span>
                  <button
                    className="bf-btn"
                    onClick={() => setVisibleFrets((v) => (v <= 4 ? 4 : ((v - 1) as 4 | 5)))}
                  >
                    −
                  </button>
                  <input className="bf-value num" value={visibleFrets} readOnly />
                  <button
                    className="bf-btn"
                    onClick={() => setVisibleFrets((v) => (v >= 5 ? 5 : ((v + 1) as 4 | 5)))}
                  >
                    +
                  </button>
                </div>

                {selectedInstrument !== "piano" && (
                  <div className="bf-group">
                    <span className="bf-label">Nốt gốc (dây)</span>
                    <select
                      className="bf-value select"
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
                  </div>
                )}
              </div>

              {/* Preview + auto-scale */}
              <div className="preview-pane" aria-label="Xem nhanh chord">
                <FitBox origin="br" className="fitbox-preview">
                  <div className="preview-card">
                    <ChordDiagram
                      shape={shape}
                      numStrings={STRINGS_MAP[selectedInstrument] === 88 ? 6 : STRINGS_MAP[selectedInstrument]}
                      showName
                      pressBias={0.46}
                    />
                  </div>
                </FitBox>
              </div>
            </aside>
          </div>

          <footer className="editor-footer">
            <div>
              <button className="btn-secondary" onClick={onBack}>
                Quay lại
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Hủy
              </button>
              <div className="editor-footer-note">Shift + kéo để chặn.</div>
              <button
                className="btn-primary"
                onClick={() => {
                  const hasAnyNote = frets.some((f) => f > 0) || barres.length > 0;
                  if (!hasAnyNote) {
                    (window as any).__toast?.("Voicing rỗng: đặt ít nhất 1 nốt hoặc chặn.", "error");
                    return;
                  }

                  // Kiểm tra thiếu ngón
                  const rows = computeDangerRows();
                  if (rows.size > 0) {
                    setDangerRows(rows);
                    (window as any).__toast?.(
                      "Thiếu thông tin: Có dây đã chọn ngăn nhưng chưa chọn NGÓN. Vui lòng bổ sung.",
                      "error"
                    );
                    return;
                  }

                  if (!hasValidBarres) {
                    (window as any).__toast?.("Thiếu thông tin: Chặn phải có NGÓN (1–4).", "error");
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
