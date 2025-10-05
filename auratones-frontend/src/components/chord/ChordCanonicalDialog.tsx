import React, { useEffect, useMemo, useState, useRef } from "react";
import "../../styles/ChordCanonicalDialog.scss";
import Toast from "../Toast";
import { useToast } from "../../hooks/useToast";
import type { Instrument } from "../../types/chord";

// ✅ NEW: dùng wrapper gọi API & type canonical
import { apiGet } from "../../lib/api";
import type { CanonicalDoc } from "../../types/chord-canonical";

/** ===== Public draft type để ChordPage lưu/khôi phục ===== */
export type CanonicalDraft = {
  rootPc: number;
  recipeId: string;
  useSlash: boolean;
  bassPc?: number;
  includeVoicing: boolean;
};

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
    includeVoicing: boolean; // để component cha kiểm tra và mở dialog voicing
  };
};

type Props = {
  isOpen: boolean;
  instrument: Instrument;
  initialSymbol?: string;
  isAdmin?: boolean;
  /** ✅ thêm prop này để khôi phục state khi quay lại */
  initialDraft?: CanonicalDraft | null;
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

/** ===== Recipe list (giữ nguyên) ===== */
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

/** 🔧 Map label -> id để hoà giải dữ liệu DB lưu label (vd: "m(add9)") */
const OPTION_ID_BY_LABEL: Record<string, string> = Object.fromEntries(
  RECIPE_OPTIONS.map(o => [o.label, o.id])
);

const ChordCanonicalDialog: React.FC<Props> = ({
  isOpen, instrument, initialSymbol = "", isAdmin = false, initialDraft = null, onClose, onSubmit,
}) => {
  const hydratedRef = useRef(false);

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
  const [includeVoicing, setIncludeVoicing] = useState(true);

  /** ===== validation flags ===== */
  const [controlsInvalid, setControlsInvalid] = useState(false);

  /** ===== NEW: dữ liệu canonical & loading ===== */
  const [canonicalItems, setCanonicalItems] = useState<CanonicalDoc[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch canonical mỗi lần mở dialog
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    apiGet<{ items: CanonicalDoc[] }>("/chords_canonical?minimal=true")
      .then(res => setCanonicalItems(Array.isArray(res.items) ? res.items : []))
      .catch(err => {
        console.error("[canonical] fetch error:", err);
        showToast("Không tải được danh sách hợp âm canonical", "error");
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  // helper nhận diện canonical có đảo bass
  const isSlashCanonical = (it: CanonicalDoc) =>
    (it as any).hasSlash === true || /_b\d+$/i.test(String(it.id || ""));

  // ✅ Chỉ lấy canonical KHÔNG đảo bass
  const allowedRecipeIds = useMemo(() => {
    const noSlash = (canonicalItems || []).filter(it => !isSlashCanonical(it));

    const ids = new Set<string>();
    for (const it of noSlash) {
      const raw = String((it as any).recipeId ?? "");
      // Nếu DB trả label (vd "m(add9)") thì đổi về id ("m_add9"); nếu đã là id thì giữ nguyên
      const asId = OPTION_ID_BY_LABEL[raw] ?? raw;
      ids.add(normalizeRecipeId(asId));
    }
    return ids;
  }, [canonicalItems]);

  /** ✅ Hydrate từ initialDraft khi mở (Back từ Voicing) — nếu không có draft thì reset mặc định */
  useEffect(() => {
    if (!isOpen) {
      hydratedRef.current = false;
      return;
    }

    if (initialDraft && !hydratedRef.current) {
      setRootPc(initialDraft.rootPc);
      setRecipeId(initialDraft.recipeId);
      setUseSlash(!!initialDraft.useSlash);
      setBassPc(initialDraft.bassPc);
      setIncludeVoicing(!!initialDraft.includeVoicing);
      setControlsInvalid(false);
      hydratedRef.current = true;
      return;
    }

    if (!initialDraft && !hydratedRef.current) {
      setRootPc(0);
      setRecipeId("major");
      setUseSlash(false);
      setBassPc(undefined);
      setIncludeVoicing(true);
      setControlsInvalid(false);
      hydratedRef.current = true;
    }
  }, [isOpen, initialDraft]);

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

    const normalized = normalizeRecipeId(recipeId);
    if (!allowedRecipeIds.has(normalized)) {
      errors.push("Phân loại hợp âm này chưa có trong canonical list.");
    }

    setControlsInvalid(errors.length > 0);
    return { ok: errors.length === 0, errors };
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="chord-modal">
        <div className="backdrop" onClick={onClose} />
        <div className={`panel compact chord-modal-panel ${useSlash ? "has-slash" : ""}`}>
          <header>
            <div className="title">Chọn phân loại hợp âm</div>
            <button className="close" onClick={onClose}>×</button>
          </header>

          {/* ===== Body + Loading Overlay ===== */}
          <section className="modal-body" aria-busy={loading ? "true" : undefined}>
            <div className="editor-body editor-split">
              <div
                className={`editor-controls card ${controlsInvalid ? "invalid" : ""} ${useSlash ? "has-slash" : ""}`}
              >
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
                      disabled={loading}
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
                      disabled={loading}
                    >
                      {RECIPE_OPTIONS.map((r) => {
                        const normalized = normalizeRecipeId(r.id);
                        const enabled = allowedRecipeIds.has(normalized);
                        return (
                          <option key={r.id} value={r.id} disabled={!enabled}>
                            {r.label}
                          </option>
                        );
                      })}
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
                        disabled={loading}
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

                {/* HÀNG DƯỚI: toggle ĐẢO BASS */}
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
                      disabled={loading}
                    >
                      {useSlash ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="bi bi-toggle-on" viewBox="0 0 16 16">
                          <path d="M5 3a5 5 0 0 0 0 10h6a5 5 0 0 0 0-10zm6 9a4 4 0 1 1 0-8 4 4 0 0 1 0 8"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-toggle-off" viewBox="0 0 16 16">
                          <path d="M11 4a4 4 0 0 1 0 8H8a5 5 0 0 0 2-4 5 5 0 0 0-2-4zm-6 8a4 4 0 1 1 0-8 4 4 0 0 1 0 8M0 8a5 5 0 0 0 5 5h6a5 5 0 0 0 0-10H5a5 5 0 0 0-5 5"/>
                        </svg>
                      )}
                      <span>Đảo bass</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Overlay loading che toàn bộ body, khóa tương tác */}
            {loading && (
              <div className="modal-loading" role="status" aria-live="polite" aria-label="Đang tải…">
                <div className="spinner" />
              </div>
            )}
          </section>

          <footer className="editor-footer">
            <div>
              <button className="btn-secondary" onClick={onClose}>Hủy</button>
              <button
                className="btn-primary"
                disabled={!canSubmit || loading}
                onClick={() => {
                  const { ok, errors } = validate();
                  if (!ok) { showToast(errors[0], "error"); return; }

                  const recipeCode = normalizeRecipeId(recipeId);
                  const baseCanonical = `r${rootPc}__${recipeCode}`;
                  const isSlash = !!(useSlash && typeof bassPc === "number");
                  const canonicalIdHint = isSlash ? `${baseCanonical}_b${bassPc}` : baseCanonical;

                  const canonical: CanonicalPayload = { pc: rootPc, recipeId, ...(isSlash ? { bassPc } : {}) };
                  const payload: SubmitPayloadCanonical = {
                    instrument,
                    symbol: (() => {
                      const rootLabel = pcToLabel(rootPc, "sharp");
                      const suffix = RECIPE_SUFFIX[recipeId] ?? `(${recipeId})`;
                      const base = `${rootLabel}${suffix}`;
                      return isSlash ? `${base}/${pcToLabel(bassPc!, "sharp")}` : base;
                    })(),
                    visibility: isAdmin ? "system" : "contribute",
                    canonical,
                    meta: {
                      intent: (isSlash ? "UPSERT_SLASH_AND_OPTIONAL_VOICING" : "ADD_VOICING_CANONICAL"),
                      isSlash,
                      recipeCode,
                      canonicalIdHint,
                      includeVoicing,
                    },
                  };

                  onSubmit(payload);
                }}
              >
                Tiếp tục
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
