import React, { useEffect, useMemo, useState } from "react";
import "../../styles/ChordCanonicalDialog.scss";
import Toast from "../Toast";
import { useToast } from "../../hooks/useToast";
import type { Instrument } from "../../types/chord";

/** ===== Types ===== */
type CanonicalPayload = {
  pc: number;
  recipeId: string;
  bassPc?: number;
};

type SubmitPayloadCanonical = {
  instrument: Instrument;
  symbol: string;
  visibility: "system" | "private" | "contribute";
  canonical: CanonicalPayload;
  meta?: {
    intent: "ADD_VOICING_CANONICAL" | "UPSERT_SLASH_AND_OPTIONAL_VOICING";
    isSlash: boolean;
    recipeCode: string;
    canonicalIdHint: string;
    includeVoicing: boolean; // ✅ comp cha kiểm tra để mở dialog voicing
  };
};

type Props = {
  isOpen: boolean;
  instrument: Instrument;
  initialSymbol?: string;
  isAdmin?: boolean;
  onClose: () => void;
  onSubmit: (payload: SubmitPayloadCanonical) => void; // chỉ gửi canonical + cờ includeVoicing
};

/** ===== Pitch helpers ===== */
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
const RECIPE_NORMALIZE: Record<string, string> = { major:"maj", minor:"m", dim:"dim", aug:"aug" };
const normalizeRecipeId = (id: string) => RECIPE_NORMALIZE[id] ?? id;

const ChordCanonicalDialog: React.FC<Props> = ({
  isOpen, instrument, initialSymbol = "", isAdmin = false, onClose, onSubmit,
}) => {
  const { message, type, showToast, hideToast } = useToast();

  useEffect(() => {
    (window as any).__toast = (msg: string, t?: 'success'|'error'|'info') => showToast(msg, t);
    return () => { (window as any).__toast = undefined; };
  }, [showToast]);

  /** ===== canonical state ===== */
  const [rootPc, setRootPc] = useState<number>(0);
  const [recipeId, setRecipeId] = useState<string>("major");
  const [useSlash, setUseSlash] = useState<boolean>(false);
  const [bassPc, setBassPc] = useState<number | undefined>(undefined);

  /** ===== options ===== */
  const [includeVoicing, setIncludeVoicing] = useState(false);

  /** ===== validation flags ===== */
  const [controlsInvalid, setControlsInvalid] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRootPc(0); setRecipeId("major"); setUseSlash(false); setBassPc(undefined);
    setIncludeVoicing(false); setControlsInvalid(false);
  }, [isOpen]);

  const symbolPreview = useMemo(() => {
    const rootLabel = pcToLabel(rootPc, "sharp");
    const suffix = RECIPE_SUFFIX[recipeId] ?? `(${recipeId})`;
    const base = `${rootLabel}${suffix}`;
    if (useSlash && typeof bassPc === "number") return `${base}/${pcToLabel(bassPc, "sharp")}`;
    return base;
  }, [rootPc, recipeId, useSlash, bassPc]);

  const canSubmit = useMemo(() => recipeId && typeof rootPc === "number", [recipeId, rootPc]);

  const validate = () => {
    const errors: string[] = [];
    if (rootPc === null || rootPc === undefined) { errors.push("Vui lòng chọn Nốt gốc."); }
    if (!recipeId) { errors.push("Vui lòng chọn Phân loại hợp âm."); }
    setControlsInvalid(errors.length > 0);
    return { ok: errors.length === 0, errors };
  };

  /** ====== helpers: build payload & submit handler ====== */
  const buildCanonicalPayload = (): SubmitPayloadCanonical | null => {
    const { ok, errors } = validate();
    if (!ok) { showToast(errors[0], "error"); return null; }

    const recipeCode = normalizeRecipeId(recipeId);
    const baseCanonical = `r${rootPc}__${recipeCode}`;
    const isSlash = !!(useSlash && typeof bassPc === "number");
    const canonicalIdHint = isSlash ? `${baseCanonical}_b${bassPc}` : baseCanonical;

    const canonical: CanonicalPayload = {
      pc: rootPc,
      recipeId,
      ...(isSlash ? { bassPc } : {}),
    };

    const symbol = (() => {
      const rootLabel = pcToLabel(rootPc, "sharp");
      const suffix = RECIPE_SUFFIX[recipeId] ?? `(${recipeId})`;
      const base = `${rootLabel}${suffix}`;
      return isSlash ? `${base}/${pcToLabel(bassPc!, "sharp")}` : base;
    })();

    const payload: SubmitPayloadCanonical = {
      instrument,
      symbol,
      visibility: isAdmin ? "system" : "contribute",
      canonical,
      meta: {
        intent: (isSlash ? "UPSERT_SLASH_AND_OPTIONAL_VOICING" : "ADD_VOICING_CANONICAL"),
        isSlash,
        recipeCode,
        canonicalIdHint,
        includeVoicing, // ✅ để comp cha quyết định mở dialog voicing
      },
    };

    return payload;
  };

  const handleSubmit = () => {
    const payload = buildCanonicalPayload();
    if (!payload) return;
    onSubmit(payload); // gửi lên parent
    onClose();         // đóng modal ngay sau khi submit
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="chord-modal">
        <div className="backdrop" onClick={onClose} />
        {/* ✅ KHÔNG mở rộng dù includeVoicing = true (luôn dùng .compact) */}
        <div className={`panel chord-panel compact ${useSlash ? "has-slash" : ""}`}>
          <header>
            <div className="title">Soạn hợp âm — Canonical</div>
            <button className="close" onClick={onClose}>×</button>
          </header>

          <div className="editor-body editor-split">
            <div className={`editor-controls card ${controlsInvalid ? "invalid" : ""} ${useSlash ? "has-slash" : ""}`}>
              {/* HÀNG TRÊN */}
              <div className="ctrl-row-main">
                <div className="ctrl-cell cell-root">
                  <label className="lbl" htmlFor="root-select">Nốt gốc</label>
                  <select
                    id="root-select"
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
                </div>

                <div className="ctrl-cell cell-recipe">
                  <label className="lbl" htmlFor="recipe-select">Phân loại</label>
                  <select
                    id="recipe-select"
                    className={!recipeId ? "select-invalid" : ""}
                    value={recipeId}
                    onChange={(e) => setRecipeId(e.target.value)}
                    aria-label="Recipe"
                  >
                    {RECIPE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>

                {useSlash && (
                  <div className="ctrl-cell cell-bass">
                    <label className="lbl" htmlFor="bass-select">Nốt bass</label>
                    <select
                      id="bass-select"
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
                  </div>
                )}

                <div className="ctrl-cell cell-preview">
                  <label className="lbl">Tên hợp âm</label>
                  <code className="preview-code">{symbolPreview}</code>
                </div>
              </div>

              {/* HÀNG DƯỚI: 2 toggle */}
              <div className="ctrl-row-toggles">
                <div className="ctrl-cell cell-toggle-slash">
                  <button
                    type="button"
                    className={`toggle ${useSlash ? "is-on" : ""}`}
                    aria-pressed={useSlash}
                    onClick={() => {
                      const next = !useSlash;
                      setUseSlash(next);
                      if (!next) setBassPc(undefined);
                    }}
                    title="Bật/tắt hợp âm đảo bass"
                  >
                    {/* SVG bootstrap sẽ lấy màu theo currentColor (đã style bằng SCSS) */}
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

                {/* ✅ vẫn có tuỳ chọn “Gửi kèm voicing”, KHÔNG mở rộng modal */}
                <div className="ctrl-cell cell-toggle-voicing">
                  <button
                    type="button"
                    className={`toggle ${includeVoicing ? "is-on" : ""}`}
                    aria-pressed={includeVoicing}
                    onClick={() => setIncludeVoicing((v) => !v)}
                    title="Gửi kèm voicing ở bước kế tiếp"
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
          </div>

          <footer className="editor-footer">
            <div>
              <button className="btn-secondary" onClick={onClose}>Hủy</button>
              <button className="btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
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

export default ChordCanonicalDialog;
