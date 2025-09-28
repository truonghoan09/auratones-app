// src/pages/ChordPage.tsx
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { ChordEntry, Instrument } from "../types/chord";
import ChordCard from "../components/chord/ChordCard";
import ChordModal from "../components/chord/ChordModal";
import "../styles/ChordPage.scss";
import Header from "../components/Header";
import { useAuthContext } from "../contexts/AuthContext";
import Auth from "../components/Auth";
import { useDialog } from "../contexts/DialogContext";
import AddChordDialog from "../components/chord/AddChordDialog";
import ChordEditorDialog from "../components/chord/ChordEditorDialog";

import { RECIPES, ALL_RECIPE_IDS } from "../data/recipes";

// ====== Helper: tạo symbol từ root + short label ======
function makeSymbol(root: string, short: string) {
  return `${root}${short}`;
}

// ====== Tập root hiển thị (thứ tự hiển thị ở sidebar) ======
const ROOTS = [
  "C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B",
] as const;

type RootName = (typeof ROOTS)[number];

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

// Lấy root từ symbol: ^([A-G])([#b])?
function getRootFromSymbol(symbol: string): RootName | null {
  const m = /^([A-G])([#b])?/i.exec(symbol.trim());
  if (!m) return null;
  const r = `${m[1].toUpperCase()}${m[2] ?? ""}` as RootName;
  return (ROOTS as readonly string[]).includes(r) ? (r as RootName) : null;
}

// Sinh data “mặc định chưa có voicing” cho một nhạc cụ
function buildDefaultChordList(instrument: Instrument): ChordEntry[] {
  const out: ChordEntry[] = [];
  for (const root of ROOTS) {
    for (const rid of ALL_RECIPE_IDS) {
      const short = RECIPES[rid]?.short ?? "";
      const symbol = makeSymbol(root, short);
      out.push({
        symbol,
        aliases: [],
        instrument,
        variants: [], // ⬅️ mặc định chưa có voicing
      });
    }
  }
  return out;
}

// ====== Bộ lọc demo cũ giữ nguyên ======
const FILTERS = {
  none: [] as string[],
  chordOfCMajor: ["C", "Dm", "Em", "F", "G", "Am"],
  chordOfCMajorPlus: [
    "C","Cmaj7","Dm","Dm7","Em","Em7","F","Fmaj7","G","G7","Am","Am7","Bdim","Bm7b5",
  ],
} as const;
type FilterKey = keyof typeof FILTERS;

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

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInstrument, setEditorInstrument] = useState<Instrument>("guitar");
  const [editorSymbol, setEditorSymbol] = useState<string>("");

  // Danh sách hợp âm (mặc định chưa có voicing)
  const allChords = useMemo(() => buildDefaultChordList(instrument), [instrument]);

  // Áp dụng filter & search
  const filtered = useMemo(() => {
    let list = allChords;

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
  }, [allChords, query, filterKey]);

  // Gom nhóm theo root để tạo section + sidebar
  const grouped = useMemo(() => {
    const map = new Map<RootName, ChordEntry[]>();
    for (const r of ROOTS) map.set(r as RootName, []);
    for (const c of filtered) {
      const r = getRootFromSymbol(c.symbol);
      if (r) map.get(r)?.push(c);
    }
    const nonEmpty = Array.from(map.entries()).filter(([, arr]) => arr.length > 0);
    return nonEmpty as Array<[RootName, ChordEntry[]]>;
  }, [filtered]);

  const totalItems = filtered.length;
  const visibleRoots = grouped.map(([r]) => r);
  const compactNav = totalItems <= 12 || visibleRoots.length <= 2; // tự động gọn nếu ít kết quả

  // ====== Scroll Spy ======
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [activeRoot, setActiveRoot] = useState<RootName | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-root") as RootName | null;
          if (id && id !== activeRoot) setActiveRoot(id);
        }
      },
      {
        root: null,
        rootMargin: "-64px 0px -60% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75, 1],
      }
    );

    grouped.forEach(([r]) => {
      const el = sectionRefs.current[r];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped.length]);

  const scrollToRoot = useCallback((r: RootName) => {
    const el = sectionRefs.current[r];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

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

  // ====== Submit từ Editor ======
  const handleSubmitEditor = useCallback(
    (payload: {
      instrument: Instrument;
      symbol: string;
      variants: any[]; // ChordShape[]
      visibility: "system" | "private" | "contribute";
    }) => {
      if (payload.visibility === "system" && !isAdmin) {
        (window as any).__toast?.("Bạn không có quyền thêm vào hệ thống.", "error");
        return;
      }
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
        {/* ⬇️ đổi className: if compact → 'compact', else → 'with-toc' */}
        <div className={`chord-page__container ${compactNav ? "compact" : "with-toc"}`}>
          {/* ===== Sidebar / Root TOC ===== */}
          {!compactNav && (
            <aside className="root-sidebar" aria-label="Mục lục theo nốt gốc">
              <div className="root-sidebar__inner">
                <div className="root-sidebar__title">Nốt gốc</div>
                <ul className="root-list" role="tablist">
                  {visibleRoots.map((r) => (
                    <li key={r}>
                      <button
                        className={`root-link ${activeRoot === r ? "active" : ""}`}
                        onClick={() => scrollToRoot(r)}
                        role="tab"
                        aria-selected={activeRoot === r}
                      >
                        {r}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}

          <section className="chord-main">
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
                    <option value="chordOfCMajorPlus">CMajor+ (thêm 7th, dim)</option>
                  </select>
                </div>
              </div>

              <div className="right" style={{ gap: 10, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
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

            {/* Chế độ gọn: root chips phía trên grid */}
            {compactNav && visibleRoots.length > 0 && (
              <div className="root-chips" aria-label="Nốt gốc">
                {visibleRoots.map((r) => (
                  <button key={r} className={`chip ${activeRoot === r ? "active" : ""}`} onClick={() => scrollToRoot(r)}>
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Grid theo từng section root */}
            {grouped.length === 0 ? (
              <div className="empty-state">
                Không tìm thấy hợp âm phù hợp bộ lọc/tìm kiếm.
              </div>
            ) : (
              <div className="root-sections">
                {grouped.map(([root, list], idx) => (
                  <section
                    key={root}
                    ref={(el) => { sectionRefs.current[root] = el; }}
                    data-root={root}
                    id={`root-${root}`}
                    className={`root-section ${idx > 0 ? "with-sep" : ""}`}
                    aria-labelledby={`heading-${root}`}
                  >
                    <div className="root-section__heading" id={`heading-${root}`}>
                      <h2 className="root-title">{root}</h2>
                      <div className="root-count">{list.length}</div>
                    </div>

                    <main className="grid" aria-live="polite">
                      {list.map((c) => (
                        <div className="cell" key={`${c.instrument}-${c.symbol}`}>
                          <ChordCard chord={c} onOpen={setOpenChord} />
                        </div>
                      ))}
                    </main>
                  </section>
                ))}
              </div>
            )}

            <div className="chord-page__spacer" />

            <ChordModal chord={openChord} onClose={() => setOpenChord(null)} />
          </section>
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

      {/* Bước 1: AddChord */}
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
