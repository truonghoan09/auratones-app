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

type AddChordPayload = {
  instrument: "guitar" | "ukulele" | "piano";
  symbol: string;
  visibility: "private" | "contribute";
  note?: string;
};

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

  const handleOpenAddChord = useCallback(() => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    openAddChord({ defaultInstrument: instrument });
  }, [isAuthenticated, instrument, openAddChord]);

  const handleSubmitAddChord = useCallback(
    async (payload: AddChordPayload) => {
      console.log("[add-chord] payload:", payload);

      (window as any).__toast?.(
        payload.visibility === "private"
          ? "Đã lưu hợp âm vào kho cá nhân."
          : "Đã gửi hợp âm để kiểm duyệt. Cảm ơn bạn!",
        "success"
      );

      closeAddChord();
    },
    [closeAddChord]
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

      {authOpen && (
        <Auth
          isModal
          onClose={() => setAuthOpen(false)}
          showToast={(msg: string, type: "success" | "error" | "info") =>
            (window as any).__toast?.(msg, type)
          }
        />
      )}

      {addChord.isOpen && (
        <AddChordDialog
          isOpen
          defaultInstrument={addChord.defaultInstrument}
          initialSymbol={addChord.initialSymbol}
          onClose={closeAddChord}
          onSubmit={handleSubmitAddChord}
        />
      )}
    </>
  );
}
