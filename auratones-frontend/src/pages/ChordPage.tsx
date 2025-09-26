import { useMemo, useState } from "react";
import type { ChordDictionary, ChordEntry, Instrument } from "../types/chord";
import { GUITAR_CHORDS } from "../data/chords/guitar";
import { UKULELE_CHORDS } from "../data/chords/ukulele";
import { PIANO_CHORDS } from "../data/chords/piano";
import ChordCard from "../components/chord/ChordCard";
import ChordModal from "../components/chord/ChordModal";
import "../styles/ChordPage.scss";
import Header from "../components/Header";

const DICT: ChordDictionary = {
  guitar: GUITAR_CHORDS,
  ukulele: UKULELE_CHORDS,
  piano: PIANO_CHORDS
};

const FILTERS = {
  none: [] as string[],
  chordOfCMajor: ["C", "Dm", "Em", "F", "G", "Am"],
  chordOfCMajorPlus: ["C", "Cmaj7", "Dm", "Dm7", "Em", "Em7", "F", "Fmaj7", "G", "G7", "Am", "Am7", "Bdim", "Bm7b5"]
} as const;
type FilterKey = keyof typeof FILTERS;

function normalize(s: string) {
  return s.toLowerCase().replace(/Δ/g, "maj7").replace(/\s+/g, "");
}

export default function ChordPage() {
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const [notation, setNotation] = useState<"long" | "symbol">("long");
  const [query, setQuery] = useState("");
  const [filterKey, setFilterKey] = useState<FilterKey>("none");
  const [openChord, setOpenChord] = useState<ChordEntry | null>(null);

  const chords = useMemo(() => {
    let list = DICT[instrument];

    if (filterKey !== "none") {
      const allow = new Set(FILTERS[filterKey].map(normalize));
      list = list.filter(c => allow.has(normalize(c.symbol)));
    }

    if (query.trim()) {
      const q = normalize(query);
      list = list.filter(c => {
        const main = normalize(c.symbol);
        const aliases = (c.aliases ?? []).map(normalize);
        return [main, ...aliases].some(n => n.includes(q));
      });
    }

    return [...list].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [instrument, query, filterKey]);

  return (
    <>
      <Header />
      <div className="chord-page">
      <header className="toolbar">
        <div className="left">
          <div className="seg">
            <button className={instrument === "guitar" ? "active" : ""} onClick={() => setInstrument("guitar")}>Guitar</button>
            <button className={instrument === "ukulele" ? "active" : ""} onClick={() => setInstrument("ukulele")}>Ukulele</button>
            <button className={instrument === "piano" ? "active" : ""} onClick={() => setInstrument("piano")}>Piano</button>
          </div>

          <div className="seg">
            <select value={filterKey} onChange={e => setFilterKey(e.target.value as FilterKey)}>
              <option value="none">Không lọc</option>
              <option value="chordOfCMajor">CMajor (C Dm Em F G Am)</option>
              <option value="chordOfCMajorPlus">CMajor+ (thêm 7th, dim)</option>
            </select>
          </div>
        </div>

        <div className="right">
          <input
            className="search"
            placeholder="Tìm hợp âm… (ví dụ: C, Am, Cmaj7 hay CΔ)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="seg">
            <button className={notation === "long" ? "active" : ""} onClick={() => setNotation("long")}>maj7</button>
            <button className={notation === "symbol" ? "active" : ""} onClick={() => setNotation("symbol")}>Δ</button>
          </div>
        </div>
      </header>

      <main className="grid">
        {chords.map((c) => (
          <div className="cell" key={`${c.instrument}-${c.symbol}`}>
            <ChordCard chord={c} notation={notation} onOpen={setOpenChord} />
          </div>
        ))}
      </main>

      <ChordModal chord={openChord} notation={notation} onClose={() => setOpenChord(null)} />
    </div>
    </>
  );
}
