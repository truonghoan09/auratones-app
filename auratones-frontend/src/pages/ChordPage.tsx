// src/pages/ChordPage.tsx
import { useMemo, useState, useCallback } from "react";
import type { ChordDictionary, ChordEntry, Instrument } from "../types/chord";
import { GUITAR_CHORDS } from "../data/chords/guitar";
import { UKULELE_CHORDS } from "../data/chords/ukulele";
import { PIANO_CHORDS } from "../data/chords/piano";
import ChordCard from "../components/chord/ChordCard";
import ChordModal from "../components/chord/ChordModal";
import "../styles/ChordPage.scss";
import Header from "../components/Header";
import { useAuthContext } from "../contexts/AuthContext";
import Auth from "../components/Auth";
import { useDialog } from "../contexts/DialogContext";
import AddChordDialog from "../components/chord/AddChordDialog";
import ChordEditorDialog from "../components/chord/ChordEditorDialog";

const DICT: ChordDictionary = {
  guitar: GUITAR_CHORDS,
  ukulele: UKULELE_CHORDS,
  piano: PIANO_CHORDS,
};

const FILTERS = {
  none: [] as string[],
  chordOfCMajor: ["C", "Dm", "Em", "F", "G", "Am"],
  chordOfCMajorPlus: [
    "C",
    "Cmaj7",
    "Dm",
    "Dm7",
    "Em",
    "Em7",
    "F",
    "Fmaj7",
    "G",
    "G7",
    "Am",
    "Am7",
    "Bdim",
    "Bm7b5",
  ],
} as const;
type FilterKey = keyof typeof FILTERS;

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

export default function ChordPage() {
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const [query, setQuery] = useState("");
  const [filterKey, setFilterKey] = useState<FilterKey>("none");
  const [openChord, setOpenChord] = useState<ChordEntry | null>(null);

  const { isAuthenticated, isLoading } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const { addChord, openAddChord, closeAddChord } = useDialog();

  // TODO: thay bằng flag thực từ AuthContext nếu có
  const isAdmin = false;

  // ====== Editor state (mở sau khi bấm "Tiếp theo" ở AddChordDialog) ======
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInstrument, setEditorInstrument] = useState<Instrument>("guitar");
  const [editorSymbol, setEditorSymbol] = useState<string>("");

  const chords = useMemo(() => {
    let list = DICT[instrument];

    if (filterKey !== "none") {
      const allow = new Set(FILTERS[filterKey].map(normalize));
      list = list.filter((c) => allow.has(normalize(c.symbol)));
    }

    if (query.trim()) {
      const q = normalize(query);
      list = list.filter((c) => {
        const main = normalize(c.symbol);
        const aliases = (c.aliases ?? []).map(normalize);
        return [main, ...aliases].some((n) => n.includes(q));
      });
    }

    return [...list].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [instrument, query, filterKey]);

  // ====== CTA mở AddChord ======
  const handleOpenAddChord = useCallback(() => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    openAddChord({ defaultInstrument: instrument });
  }, [isAuthenticated, instrument, openAddChord]);

  // ====== Nhận sự kiện Next từ AddChordDialog -> mở Editor ======
  const handleNextAddChord = useCallback(
    ({ instrument: ins, symbol }: { instrument: Instrument; symbol: string }) => {
      closeAddChord();
      setEditorInstrument(ins);
      setEditorSymbol(symbol);
      setEditorOpen(true);
    },
    [closeAddChord]
  );

  // ====== Submit từ Editor (system/private/contribute) ======
  const handleSubmitEditor = useCallback(
    (payload: {
      instrument: Instrument;
      symbol: string;
      variants: any[]; // ChordShape[]
      visibility: "system" | "private" | "contribute";
    }) => {
      // Chặn nếu user không phải admin mà chọn "system"
      if (payload.visibility === "system" && !isAdmin) {
        (window as any).__toast?.("Bạn không có quyền thêm vào hệ thống.", "error");
        return;
      }

      // TODO: gọi API tương ứng ở đây
      // - system: POST /api/chords/system
      // - private: POST /api/chords/my
      // - contribute: POST /api/chords/contributions (đợi duyệt)
      console.log("[editor-submit]", payload);

      (window as any).__toast?.(
        payload.visibility === "system"
          ? "Đã bổ sung vào hệ thống."
          : payload.visibility === "private"
          ? "Đã lưu hợp âm vào kho cá nhân."
          : "Đã gửi hợp âm để kiểm duyệt. Cảm ơn bạn!",
        "success"
      );
      setEditorOpen(false);
    },
    [isAdmin]
  );

  return (
    <>
      <Header />

      <div className="chord-page__surface">
        <div className="chord-page__container">
          <header className="toolbar">
            <div className="left">
              <div className="seg" role="tablist" aria-label="Chọn nhạc cụ">
                <button
                  className={instrument === "guitar" ? "active" : ""}
                  onClick={() => setInstrument("guitar")}
                  role="tab"
                  aria-selected={instrument === "guitar"}
                >
                  Guitar
                </button>
                <button
                  className={instrument === "ukulele" ? "active" : ""}
                  onClick={() => setInstrument("ukulele")}
                  role="tab"
                  aria-selected={instrument === "ukulele"}
                >
                  Ukulele
                </button>
                <button
                  className={instrument === "piano" ? "active" : ""}
                  onClick={() => setInstrument("piano")}
                  role="tab"
                  aria-selected={instrument === "piano"}
                >
                  Piano
                </button>
              </div>

              <div className="seg">
                <select
                  value={filterKey}
                  onChange={(e) => setFilterKey(e.target.value as FilterKey)}
                  aria-label="Bộ lọc hợp âm"
                >
                  <option value="none">Không lọc</option>
                  <option value="chordOfCMajor">CMajor (C Dm Em F G Am)</option>
                  <option value="chordOfCMajorPlus">
                    CMajor+ (thêm 7th, dim)
                  </option>
                </select>
              </div>
            </div>

            <div
              className="right"
              style={{
                gap: 10,
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                className="search"
                placeholder="Tìm hợp âm… (ví dụ: C, Am, Cmaj7)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Tìm hợp âm"
              />

              <button
                className="btn-primary"
                onClick={handleOpenAddChord}
                disabled={isLoading}
                title={
                  isAuthenticated
                    ? "Thêm hợp âm của bạn hoặc gửi đóng góp"
                    : "Đăng nhập để thêm/đóng góp hợp âm"
                }
                aria-label="Thêm hợp âm"
              >
                Thêm hợp âm
              </button>
            </div>
          </header>

          <main className="grid" aria-live="polite">
            {chords.map((c) => (
              <div className="cell" key={`${c.instrument}-${c.symbol}`}>
                <ChordCard chord={c} onOpen={setOpenChord} />
              </div>
            ))}
          </main>

          <div className="chord-page__spacer" />

          <ChordModal chord={openChord} onClose={() => setOpenChord(null)} />
        </div>
      </div>

      {/* Auth modal khi chưa đăng nhập */}
      {authOpen && (
        <Auth
          isModal
          onClose={() => setAuthOpen(false)}
          showToast={(msg: string, type: "success" | "error" | "info") =>
            (window as any).__toast?.(msg, type)
          }
        />
      )}

      {/* Bước 1: AddChord (nhận “Tiếp theo”) */}
      {addChord.isOpen && (
        <AddChordDialog
          isOpen
          defaultInstrument={addChord.defaultInstrument}
          initialSymbol={addChord.initialSymbol}
          onClose={closeAddChord}
          onNext={handleNextAddChord}
        />
      )}

      {/* Bước 2: Editor */}
      {editorOpen && (
        <ChordEditorDialog
          isOpen
          instrument={editorInstrument}
          initialSymbol={editorSymbol}
          isAdmin={isAdmin}
          onClose={() => setEditorOpen(false)}
          onSubmit={handleSubmitEditor}
        />
      )}
    </>
  );
}
