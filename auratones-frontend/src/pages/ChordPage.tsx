import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { ChordEntry, Instrument } from "../types/chord";
import ChordCard from "../components/chord/ChordCard";
import ChordModal from "../components/chord/ChordModal";
import "../styles/ChordPage.scss";
import Header from "../components/Header";
import { useAuthContext } from "../contexts/AuthContext";
import Auth from "../components/Auth";
import ChordCanonicalDialog, { type CanonicalDraft } from "../components/chord/ChordCanonicalDialog";
import ChordVoicingDialog from "../components/chord/ChordVoicingDialog";

import { fetchChords, postChord } from "../services/chords";

const ROOTS = ["C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B"] as const;
type RootName = (typeof ROOTS)[number];

function normalize(s: string) { return s.toLowerCase().replace(/\s+/g, ""); }
function getRootFromSymbol(symbol: string): RootName | null {
  const m = /^([A-G])([#b])?/i.exec(symbol.trim());
  if (!m) return null;
  const r = `${m[1].toUpperCase()}${m[2] ?? ""}` as RootName;
  return (ROOTS as readonly string[]).includes(r) ? (r as RootName) : null;
}

const FILTERS = {
  none: [] as string[],
  chordOfCMajor: ["C", "Dm", "Em", "F", "G", "Am"],
  chordOfCMajorPlus: ["C","Cmaj7","Dm","Dm7","Em","Em7","F","Fmaj7","G","G7","Am","Am7","Bdim","Bm7b5"],
} as const;
type FilterKey = keyof typeof FILTERS;

export default function ChordPage() {

  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const [query, setQuery] = useState("");
  const [filterKey, setFilterKey] = useState<FilterKey>("none");
  const [openChord, setOpenChord] = useState<ChordEntry | null>(null);

  const { isAuthenticated, isLoading, isAdmin } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);

  // ===== backend data =====
  const [serverChords, setServerChords] = useState<ChordEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pendingBackRef = useRef(false);


  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    setServerChords(null);
    fetchChords(instrument)
      .then((items) => {
        if (!alive) return;
        const sorted = Array.isArray(items) ? [...items].sort((a, b) => a.symbol.localeCompare(b.symbol)) : [];
        setServerChords(sorted);
      })
      .catch((e) => { if (alive) setErr(e?.message ?? "Lỗi tải dữ liệu"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [instrument]);

  const allChords = useMemo<ChordEntry[]>(() => serverChords ?? [], [serverChords]);

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

  const grouped = useMemo(() => {
    const map = new Map<RootName, ChordEntry[]>();
    for (const r of ROOTS) map.set(r as RootName, []);
    for (const c of filtered) {
      const r = getRootFromSymbol(c.symbol);
      if (r) map.get(r)?.push(c);
    }
    return Array.from(map.entries()).filter(([, arr]) => arr.length > 0) as Array<[RootName, ChordEntry[]]>;
  }, [filtered]);

  const totalItems = filtered.length;
  const visibleRoots = grouped.map(([r]) => r);
  const compactNav = totalItems <= 12 || visibleRoots.length <= 2;

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [activeRoot, setActiveRoot] = useState<RootName | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-root") as RootName | null;
          if (id && id !== activeRoot) setActiveRoot(id);
        }
      },
      { root: null, rootMargin: "-64px 0px -60% 0px", threshold: [0.1, 0.25, 0.5, 0.75, 1] }
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

  // ===== Canonical dialog state =====
  const [canonicalOpen, setCanonicalOpen] = useState(false);
  const [canonicalInstrument, setCanonicalInstrument] = useState<Instrument>("guitar");
  const [canonicalSymbol, setCanonicalSymbol] = useState<string>("");
  const [canonicalDraft, setCanonicalDraft] = useState<CanonicalDraft | null>(null); // lưu state để “quay lại”

  // ===== Voicing dialog state =====
  const [voicingOpen, setVoicingOpen] = useState(false);
  const [voicingInstrument, setVoicingInstrument] = useState<Instrument>("guitar");
  const [voicingSymbol, setVoicingSymbol] = useState<string>("");

  // ===== Submit từ Canonical =====
  const handleSubmitCanonical = useCallback(async (payload: {
    instrument: Instrument;
    symbol: string;
    visibility: "system" | "private" | "contribute";
    canonical: { pc: number; recipeId: string; bassPc?: number };
    meta?: { includeVoicing?: boolean; isSlash?: boolean };
  }) => {
    const includeVoicing = !!payload.meta?.includeVoicing;

    // Lưu draft để quay lại sau (nếu user vào Voicing rồi bấm quay lại)
    setCanonicalInstrument(payload.instrument);
    setCanonicalSymbol(payload.symbol);
    setCanonicalDraft({
      rootPc: payload.canonical.pc,
      recipeId: payload.canonical.recipeId,
      useSlash: !!payload.meta?.isSlash,
      bassPc: payload.canonical.bassPc,
      includeVoicing,
    });

    setCanonicalOpen(false);

    if (includeVoicing) {
      // Mở voicing (trắng mỗi lần mở)
      setVoicingInstrument(payload.instrument);
      setVoicingSymbol(payload.symbol);
      setVoicingOpen(true);
      return;
    }

    // Không kèm voicing → gửi thẳng
    try {
      await postChord({
        instrument: payload.instrument,
        symbol: payload.symbol,
        variants: [],
        visibility: isAdmin ? "system" : "contribute",
      });
      (window as any).__toast?.(isAdmin ? "Đã gửi hợp âm vào hệ thống." : "Đã gửi bản đóng góp (preview).", "success");
      // Hoàn tất flow → clear draft
      setCanonicalDraft(null);
      setCanonicalOpen(false);
    } catch (e: any) {
      console.error(e);
      (window as any).__toast?.(e?.message || "Gửi hợp âm thất bại", "error");
    }
  }, [isAdmin]);

  // Hủy Canonical → xóa draft
  const handleCloseCanonical = useCallback(() => {
    setCanonicalOpen(false);
    setCanonicalDraft(null); // chỉ khi HỦY mới xóa dữ liệu
  }, []);

  // Back từ Voicing → quay lại Canonical với draft
  const handleBackFromVoicing = () => {
    pendingBackRef.current = true;
    console.log('canonicalDraft: ',canonicalDraft);
    setVoicingOpen(false);
  };

  useEffect(() => {
    if (!voicingOpen && pendingBackRef.current) {
      pendingBackRef.current = false;
      // mở lại canonical SAU KHI voicing đã đóng xong
      setCanonicalOpen(true);
    }
  }, [voicingOpen]);

  useEffect(() => {
    if (!voicingOpen) {
      console.log('[ChordPage] voicing closed. canonicalDraft =', canonicalDraft);
    }
  }, [voicingOpen, canonicalDraft]);

  // Submit Voicing → gửi variants
  const handleSubmitVoicing = useCallback(async (payload: {
    instrument: Instrument;
    symbol: string;
    variants: any[];
  }) => {
    try {
      await postChord({
        instrument: payload.instrument,
        symbol: payload.symbol,
        variants: payload.variants,
        visibility: isAdmin ? "system" : "contribute",
      });
      (window as any).__toast?.(isAdmin ? "Đã gửi hợp âm vào hệ thống." : "Đã gửi bản đóng góp (preview).", "success");
      setVoicingOpen(false);
      setCanonicalDraft(null); // hoàn tất thì clear draft
    } catch (e: any) {
      console.error(e);
      (window as any).__toast?.(e?.message || "Gửi hợp âm thất bại", "error");
    }
  }, [isAdmin]);

  // ===== mở Canonical trực tiếp khi bấm “Thêm hợp âm” =====
  const handleOpenCanonicalDirect = useCallback(() => {
    if (!isAuthenticated) { setAuthOpen(true); return; }
    setCanonicalInstrument(instrument);
    setCanonicalSymbol("");     // hoặc điền gợi ý nếu bạn muốn
    setCanonicalDraft(null);    // bắt đầu trắng
    setCanonicalOpen(true);
  }, [isAuthenticated, instrument]);

  return (
    <>
      <Header />

      <div className="chord-page__surface">
        <div className={`chord-page__container ${compactNav ? "compact" : "with-toc"}`}>
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
                  <button className={instrument === "guitar" ? "active" : ""} onClick={() => setInstrument("guitar")} role="tab" aria-selected={instrument === "guitar"}>Guitar</button>
                  <button className={instrument === "ukulele" ? "active" : ""} onClick={() => setInstrument("ukulele")} role="tab" aria-selected={instrument === "ukulele"}>Ukulele</button>
                  <button className={instrument === "piano" ? "active" : ""} onClick={() => setInstrument("piano")} role="tab" aria-selected={instrument === "piano"}>Piano</button>
                </div>

                <div className="seg">
                  <select value={filterKey} onChange={(e) => setFilterKey(e.target.value as FilterKey)} aria-label="Bộ lọc hợp âm">
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
                <button className="btn-primary" onClick={handleOpenCanonicalDirect} disabled={isLoading}>
                  Thêm hợp âm
                </button>
              </div>
            </header>

            {loading && <div className="empty-state">Đang tải hợp âm từ máy chủ…</div>}
            {err && !loading && <div className="empty-state">Không tải được dữ liệu: {err}</div>}

            {compactNav && visibleRoots.length > 0 && (
              <div className="root-chips" aria-label="Nốt gốc">
                {visibleRoots.map((r) => (
                  <button key={r} className={`chip ${activeRoot === r ? "active" : ""}`} onClick={() => scrollToRoot(r)}>
                    {r}
                  </button>
                ))}
              </div>
            )}

            {grouped.length === 0 ? (
              <div className="empty-state">Không tìm thấy hợp âm phù hợp bộ lọc/tìm kiếm.</div>
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

      {/* Auth modal */}
      {authOpen && (
        <Auth
          isModal
          onClose={() => setAuthOpen(false)}
          showToast={(msg: string, type: "success" | "error" | "info") =>
            (window as any).__toast?.(msg, type)
          }
        />
      )}

      {/* Canonical (mở ngay khi bấm “Thêm hợp âm”), có khả năng khôi phục state khi quay lại */}
      {canonicalOpen && (
        <ChordCanonicalDialog
          isOpen
          instrument={canonicalInstrument}
          initialSymbol={canonicalSymbol}
          isAdmin={isAdmin}
          initialDraft={canonicalDraft}              // khôi phục nếu có
          onClose={handleCloseCanonical}             // Hủy → clear draft
          onSubmit={handleSubmitCanonical}           // lưu + quyết định next
        />
      )}

      {/* Voicing (luôn blank mỗi lần mở) */}
      {voicingOpen && (
        <ChordVoicingDialog
          isOpen
          instrument={voicingInstrument}
          symbol={voicingSymbol}
          onClose={() => setVoicingOpen(false)}
          onSubmit={handleSubmitVoicing}
          onBack={handleBackFromVoicing}
        />
      )}
    </>
  );
}
