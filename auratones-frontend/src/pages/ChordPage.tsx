// src/pages/ChordPage.tsx
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { ChordEntry, Instrument } from "../types/chord";
import ChordCard from "../components/chord/ChordCard";
import ChordModal from "../components/chord/ChordModal";
import "../styles/ChordPage.scss";
import Header from "../components/Header";
import { useAuthContext } from "../contexts/AuthContext";
import Auth from "../components/Auth";
import DeleteVoicingScopeDialog from "../components/chord/DeleteVoicingScopeDialog";


import { fetchChords, postChord, postChordVoicing, deleteChordVoicing } from "../services/chords";

type CanonicalDraft = {
  rootPc: number;
  recipeId: string;
  useSlash: boolean;
  bassPc?: number;
  includeVoicing?: boolean;
};

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

type EditDeletePayload = { chord: ChordEntry; variantIndex: number };

export default function ChordPage() {
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const [query, setQuery] = useState("");
  const [filterKey, setFilterKey] = useState<FilterKey>("none");
  const [openChord, setOpenChord] = useState<ChordEntry | null>(null);

  const { isAuthenticated, isLoading, isAdmin } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);

  const [serverChords, setServerChords] = useState<ChordEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pendingBackRef = useRef(false);

  const refreshChords = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const items = await fetchChords(instrument);
      const sorted = Array.isArray(items) ? [...items].sort((a, b) => a.symbol.localeCompare(b.symbol)) : [];
      setServerChords(sorted);
    } catch (e: any) {
      setErr(e?.message ?? "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [instrument]);

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
    const map = new Map<RootName, any[]>();
    for (const r of ROOTS) map.set(r as RootName, []);
    for (const c of filtered) {
      const r = getRootFromSymbol(c.symbol);
      if (r) map.get(r)?.push(c);
    }
    return Array.from(map.entries()).filter(([, arr]) => arr.length > 0) as Array<[RootName, any[]]>;
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

  // Canonical & Voicing dialogs (giữ)
  const [canonicalOpen, setCanonicalOpen] = useState(false);
  const [canonicalInstrument, setCanonicalInstrument] = useState<Instrument>("guitar");
  const [canonicalSymbol, setCanonicalSymbol] = useState<string>("");
  const [canonicalDraft, setCanonicalDraft] = useState<CanonicalDraft | null>(null);

  const [voicingOpen, setVoicingOpen] = useState(false);
  const [voicingInstrument, setVoicingInstrument] = useState<Instrument>("guitar");
  const [voicingSymbol, setVoicingSymbol] = useState<string>("");

  // Delete Scope dialog (giữ)
  const [delScopeOpen, setDelScopeOpen] = useState(false);
  const [delScopeChord, setDelScopeChord] = useState<ChordEntry | null>(null);
  const [delScopeIndex, setDelScopeIndex] = useState<number | null>(null);

  const handleSubmitCanonical = useCallback(async (payload: {
    instrument: Instrument;
    symbol: string;
    visibility: "system" | "private" | "contribute";
    canonical: { pc: number; recipeId: string; bassPc?: number };
    meta?: { includeVoicing?: boolean; isSlash?: boolean };
  }) => {
    const includeVoicing = !!payload.meta?.includeVoicing;

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
      setVoicingInstrument(payload.instrument);
      setVoicingSymbol(payload.symbol);
      setVoicingOpen(true);
      return;
    }

    try {
      await postChord({
        instrument: payload.instrument,
        symbol: payload.symbol,
        variants: [],
        visibility: isAdmin ? "system" : "contribute",
      });
      (window as any).__toast?.(isAdmin ? "Đã gửi hợp âm vào hệ thống." : "Đã gửi bản đóng góp (preview).", "success");
      setCanonicalDraft(null);
      setCanonicalOpen(false);
    } catch (e: any) {
      console.error(e);
      (window as any).__toast?.(e?.message || "Gửi hợp âm thất bại", "error");
    }
  }, [isAdmin]);

  const handleCloseCanonical = useCallback(() => {
    setCanonicalOpen(false);
    setCanonicalDraft(null);
  }, []);

  const handleBackFromVoicing = () => {
    pendingBackRef.current = true;
    setVoicingOpen(false);
  };

  useEffect(() => {
    if (!voicingOpen && pendingBackRef.current) {
      pendingBackRef.current = false;
      setCanonicalOpen(true);
    }
  }, [voicingOpen]);

  const handleSubmitVoicing = useCallback(async (payload: {
    instrument: Instrument;
    symbol: string;
    variants: any[];
  }) => {
    const bundleForInspect = {
      fromVoicingDialog: payload,
      canonicalDraftSnapshot: canonicalDraft ?? null,
      combinedForSubmitPreview: {
        instrument: payload.instrument,
        symbol: payload.symbol,
        canonical: canonicalDraft
          ? {
              rootPc: canonicalDraft.rootPc,
              recipeId: canonicalDraft.recipeId,
              bassPc: canonicalDraft.bassPc,
              useSlash: canonicalDraft.useSlash,
            }
          : null,
        variants: payload.variants,
      },
    };

    try {
      await postChordVoicing(bundleForInspect);
      (window as any).__toast?.("Đã lưu voicing vào hệ thống.", "success");
      setVoicingOpen(false);
      setCanonicalDraft(null);
      await refreshChords();
    } catch (e: any) {
      if (e?.duplicate) {
        const ok = window.confirm(e?.data?.message || "Voicing trùng. Bạn có muốn vẫn lưu?");
        if (!ok) {
          (window as any).__toast?.("Đã hủy lưu vì trùng voicing.", "info");
          return;
        }
        try {
          await postChordVoicing(bundleForInspect, { confirm: true });
          (window as any).__toast?.("Đã lưu voicing (đã xác nhận ghi đè/trùng).", "success");
          setVoicingOpen(false);
          setCanonicalDraft(null);
          await refreshChords();
        } catch (ee: any) {
          console.error(ee);
          (window as any).__toast?.(ee?.message || "Ghi voicing thất bại", "error");
        }
      } else {
        console.error(e);
        (window as any).__toast?.(e?.message || "Ghi voicing thất bại", "error");
      }
    }
  }, [canonicalDraft, refreshChords]);

  const handleOpenCanonicalDirect = useCallback(() => {
    if (!isAuthenticated) { setAuthOpen(true); return; }
    setCanonicalInstrument(instrument);
    setCanonicalSymbol("");
    setCanonicalDraft(null);
    setCanonicalOpen(true);
  }, [isAuthenticated, instrument]);

  const handleEditVoicing = useCallback((payload: EditDeletePayload) => {
    console.log("đang bấm edit", payload);
  }, []);

  const handleDeleteVoicing = useCallback(async (payload: EditDeletePayload) => {
    if (!payload?.chord) return;
    const { chord, variantIndex } = payload;
    const variant = chord?.variants?.[variantIndex];
    if (!variant) {
      (window as any).__toast?.("Không tìm thấy voicing cần xoá.", "error");
      return;
    }
    setDelScopeChord(chord);
    setDelScopeIndex(variantIndex);
    setDelScopeOpen(true);
  }, []);

  const handleConfirmDeleteScope = useCallback(async (scope: "single" | "shape+fingers") => {
    try {
      const chord = delScopeChord!;
      const variantIndex = delScopeIndex!;
      const variant = chord.variants[variantIndex];

      const visibility = isAdmin ? "system" : "private";

      await deleteChordVoicing({
        instrument: chord.instrument,
        symbol: chord.symbol,
        variant,
        scope,
        visibility,
      });

      (window as any).__toast?.(
        scope === "shape+fingers"
          ? "Đã xoá voicing (bao gồm các bản cùng form & fingers)."
          : "Đã xoá voicing.",
        "success"
      );

      setOpenChord((prev) => {
        if (!prev) return prev;
        if (prev.instrument !== chord.instrument || prev.symbol !== chord.symbol) return prev;
        const nextVariants = [...(prev.variants || [])].filter((_, i) => i !== variantIndex);
        if (nextVariants.length === 0) return null;
        return { ...prev, variants: nextVariants };
      });

      setDelScopeOpen(false);
      setDelScopeChord(null);
      setDelScopeIndex(null);

      await refreshChords();
    } catch (e: any) {
      console.error(e);
      (window as any).__toast?.(e?.message || "Xoá voicing thất bại.", "error");
    }
  }, [delScopeChord, delScopeIndex, isAdmin, refreshChords]);
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
            <ChordModal
              chord={openChord}
              onClose={() => setOpenChord(null)}
              isAdmin={isAdmin}
              onEditVoicing={handleEditVoicing}
              onDeleteVoicing={handleDeleteVoicing}
            />
          </section>
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

      <DeleteVoicingScopeDialog
        isOpen={delScopeOpen}
        chord={delScopeChord}
        variantIndex={delScopeIndex}
        isAdmin={isAdmin}
        onClose={() => { setDelScopeOpen(false); setDelScopeChord(null); setDelScopeIndex(null); }}
        onConfirm={handleConfirmDeleteScope}
      />
    </>
  );
}
