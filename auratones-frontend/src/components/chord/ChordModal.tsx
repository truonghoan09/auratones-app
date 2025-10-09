// src/components/chord/ChordModal.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import type { ChordEntry } from "../../types/chord";
import ChordDiagram from "./ChordDiagram";
import PianoDiagram from "./PianoDiagram";
import { toggleVoicingLike, fetchVoicingLikes } from "../../services/chords"; // <-- thêm fetchVoicingLikes
import "../../styles/ChordModal.scss";

/** ====== Props ====== */
type Props = {
  chord: ChordEntry | null;
  onClose: () => void;
  isAdmin?: boolean;
  onEditVoicing?: (payload: { chord: ChordEntry; variantIndex: number }) => void;
  onDeleteVoicing?: (payload: { chord: ChordEntry; variantIndex: number }) => void;
};

/** ====== Sorting State ====== */
type PriorityMode = "default" | "popularity"; // baseFret asc vs likesCount
type MineDir = "asc" | "desc";               // your like timeline ↑(older-first) / ↓(newer-first)

/** ====== Helpers (khớp với BE relaxed FP) ====== */
function isNumber(x: any): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function asInt(x: any, def: number) {
  const n = Number.parseInt(x, 10);
  return Number.isFinite(n) ? n : def;
}
function fpRelaxed(v: any): string {
  const frets = Array.isArray(v?.frets) ? v.frets.map((n: any) => asInt(n, 0)) : [];
  const normBarres = Array.isArray(v?.barres)
    ? v.barres.map((b: any) => {
        const fret = asInt(b?.fret, -1);
        const from = asInt(b?.from, -1);
        const to = asInt(b?.to, -1);
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        const finger = isNumber(b?.finger) ? b.finger : null;
        return { fret, from: lo, to: hi, finger };
      })
    : [];
  const fgs = Array.isArray(v?.fingers) ? v.fingers.map((n: any) => asInt(n, 0)) : [];
  const normFingers = fgs.length > 0 && fgs.every((n: number) => n === 0) ? [] : fgs;
  return JSON.stringify({ frets, barres: normBarres, fingers: normFingers });
}

// min “hiệu dụng” để tie-break khi baseFret trùng
function minUsedFret(v: any): number {
  const frets = Array.isArray(v?.frets) ? v.frets : [];
  let min = Infinity;
  for (let i = 0; i < frets.length; i++) {
    const f = frets[i];
    if (isNumber(f) && f > 0) min = Math.min(min, f);
  }
  if (!Number.isFinite(min)) return 9999;
  return min;
}

export default function ChordModal({
  chord,
  onClose,
  isAdmin,
  onEditVoicing,
  onDeleteVoicing,
}: Props) {
  /** ===== Hooks: giữ đúng thứ tự, không nằm trong if ===== */
  const [index, setIndex] = useState(0);

  // Sorting UI states
  const [priority, setPriority] = useState<PriorityMode>("default");
  const [mineEnabled, setMineEnabled] = useState<boolean>(false);
  const [mineDir, setMineDir] = useState<MineDir>("desc");

  // Likes
  const [likesCount, setLikesCount] = useState<Record<string, number>>({});
  const [userLikedFp, setUserLikedFp] = useState<Record<string, number>>({}); // fp -> likedAt ts

  const containerRef = useRef<HTMLDivElement>(null);
  const gradId = useMemo(() => `heartGrad_${Math.random().toString(36).slice(2)}`, []);

  // Reset khi chord đổi (giữ nguyên của bạn)
  useEffect(() => {
    setIndex(0);

    if (chord?.likesCountByFp) setLikesCount(chord.likesCountByFp);
    else setLikesCount({});

    if (chord?.userLikesFpToTs) setUserLikedFp(chord.userLikesFpToTs);
    else setUserLikedFp({});
  }, [chord]);

  // ✅ NEW: hydrate likes từ BE để đảm bảo sau reload không về 0
  useEffect(() => {
    if (!chord) return;
    let alive = true;

    fetchVoicingLikes({ instrument: chord.instrument, symbol: chord.symbol })
      .then((res) => {
        if (!alive) return;
        if (res?.countsByFp) setLikesCount(res.countsByFp);
        if (res?.userLikesFpToTs) setUserLikedFp(res.userLikesFpToTs);
      })
      .catch(() => {
        // im lặng nếu lỗi mạng, vẫn dùng dữ liệu sẵn có
      });

    return () => { alive = false; };
  }, [chord?.instrument, chord?.symbol]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!chord) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setIndex((i) => Math.min((orderedIndices.length || 1) - 1, i + 1));
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [chord, onClose]); // cố ý không phụ thuộc orderedIndices để tránh rebind liên tục

  // Swipe
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startX = 0, dx = 0, active = false;

    const onStart = (e: TouchEvent | MouseEvent) => {
      active = true;
      startX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      dx = 0;
    };
    const onMove = (e: TouchEvent | MouseEvent) => {
      if (!active) return;
      const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      dx = x - startX;
      (el as HTMLElement).style.setProperty("--offset", `${dx}px`);
      el.classList.add("dragging");
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      el.classList.remove("dragging");
      (el as HTMLElement).style.removeProperty("--offset");
      if (!chord) return;

      const total = orderedIndices.length;
      if (dx < -60 && index < total - 1) setIndex(index + 1);
      else if (dx > 60 && index > 0) setIndex(index - 1);
    };

    el.addEventListener("mousedown", onStart);
    el.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);

    return () => {
      el.removeEventListener("mousedown", onStart);
      el.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [index, chord]);

  // Detect admin (giữ nguyên cho edit/delete)
  const admin = useMemo(() => {
    if (typeof isAdmin === "boolean") return isAdmin;
    try {
      const w = window as any;
      if (w?.__auth?.role === "admin") return true;
      if (w?.__user?.role === "admin") return true;
      const stored = localStorage.getItem("role");
      if (stored && stored.toLowerCase() === "admin") return true;
    } catch {}
    return false;
  }, [isAdmin]);

  /** ====== Build base orders ====== */
  const defaultOrder = useMemo(() => {
    const n = chord?.variants?.length ?? 0;
    if (!chord || n === 0) return [] as number[];
    const arr = chord.variants.map((v, i) => ({
      i,
      bf: isNumber((v as any).baseFret) ? (v as any).baseFret : 9999,
      mu: minUsedFret(v),
    }));
    arr.sort((a, b) => (a.bf - b.bf) || (a.mu - b.mu) || (a.i - b.i));
    return arr.map((x) => x.i);
  }, [chord]);

  const popularityOrder = useMemo(() => {
    if (!chord) return [] as number[];
    const withKey = defaultOrder.map((i, ord) => {
      const fp = fpRelaxed(chord.variants[i]);
      const cnt = likesCount[fp] ?? 0;
      return { i, cnt, ord };
    });
    withKey.sort((a, b) => {
      if (b.cnt !== a.cnt) return b.cnt - a.cnt;
      return a.ord - b.ord;
    });
    return withKey.map((x) => x.i);
  }, [chord, defaultOrder, likesCount]);

  const mineAscFirst = useMemo(() => {
    if (!chord) return [] as number[];
    const likedPairs: Array<{ i: number; ts: number; ord: number }> = [];
    for (const i of defaultOrder) {
      const v = chord.variants[i];
      const ts = userLikedFp[fpRelaxed(v)];
      if (isNumber(ts)) likedPairs.push({ i, ts, ord: defaultOrder.indexOf(i) });
    }
    likedPairs.sort((a, b) => (a.ts - b.ts) || (a.ord - b.ord));
    return likedPairs.map((x) => x.i);
  }, [chord, defaultOrder, userLikedFp]);

  const mineDescFirst = useMemo(() => {
    if (!chord) return [] as number[];
    const likedPairs: Array<{ i: number; ts: number; ord: number }> = [];
    for (const i of defaultOrder) {
      const v = chord.variants[i];
      const ts = userLikedFp[fpRelaxed(v)];
      if (isNumber(ts)) likedPairs.push({ i, ts, ord: defaultOrder.indexOf(i) });
    }
    likedPairs.sort((a, b) => (b.ts - a.ts) || (a.ord - b.ord));
    return likedPairs.map((x) => x.i);
  }, [chord, defaultOrder, userLikedFp]);

  /** ====== Compose final ordered indices ====== */
  const orderedIndices = useMemo(() => {
    if (!chord) return [] as number[];

    if (!mineEnabled) {
      return priority === "default" ? defaultOrder : popularityOrder;
    }

    const minePart = (mineDir === "asc" ? mineAscFirst : mineDescFirst);
    const likedSet = new Set(minePart);
    const base = (priority === "default" ? defaultOrder : popularityOrder).filter(i => !likedSet.has(i));

    return [...minePart, ...base];
  }, [chord, mineEnabled, mineDir, priority, defaultOrder, popularityOrder, mineAscFirst, mineDescFirst]);

  const variantsOrdered = useMemo(() => {
    if (!chord) return [] as any[];
    return orderedIndices.map((i) => chord.variants[i]);
  }, [chord, orderedIndices]);

  /** ====== Current slide state ====== */
  const isOpen = !!chord;
  if (!isOpen) return null;
  const c = chord as ChordEntry;

  const name = c.symbol;
  const isPiano = c.instrument === "piano";
  const count = variantsOrdered.length;

  const currentOriginalIndex = orderedIndices[index] ?? 0;
  const currentVariant = c.variants[currentOriginalIndex];
  const currentFp = fpRelaxed(currentVariant);
  const currentLiked = !!userLikedFp[currentFp];
  const currentLikes = likesCount[currentFp] ?? 0;

  /** ====== Actions ====== */
  const handleToggleLike = async () => {
    try {
      // optimistic
      setUserLikedFp((prev) => {
        const next = { ...prev };
        if (next[currentFp]) delete next[currentFp];
        else next[currentFp] = Date.now();
        return next;
      });

      const resp = await toggleVoicingLike({
        instrument: c.instrument,
        symbol: c.symbol,
        variant: currentVariant,
      });

      setLikesCount((prev) => ({ ...prev, [currentFp]: resp.count }));
      setUserLikedFp((prev) => {
        const next = { ...prev };
        if (resp.liked) next[currentFp] = resp.likedAt || Date.now();
        else delete next[currentFp];
        return next;
      });
    } catch (e: any) {
      // rollback đơn giản
      setUserLikedFp((prev) => {
        const next = { ...prev };
        if (currentLiked) next[currentFp] = Date.now();
        else delete next[currentFp];
        return next;
      });
      setLikesCount((prev) => {
        const base = prev[currentFp] ?? 0;
        return { ...prev, [currentFp]: currentLiked ? base + 1 : Math.max(0, base - 1) };
      });
      (window as any).__toast?.(e?.message || "Không gửi được trạng thái yêu thích.", "error");
    }
  };

  /** ====== Render ====== */
  return (
    <div className="chord-modal" role="dialog" aria-modal="true">
      <div className="backdrop" onClick={onClose} />
      <div className="panel" ref={containerRef}>
        <header className="cm-header">
          <div className="title-wrap">
            <div className="title">{name}</div>

            {/* Heart + Count (ngay cạnh tên) */}
            <button
              className={`like-chip ${currentLiked ? "liked" : ""}`}
              onClick={handleToggleLike}
              title={currentLiked ? "Bỏ yêu thích voicing này" : "Yêu thích voicing này"}
              aria-pressed={currentLiked}
              disabled={!currentVariant}
            >
              <span className="icon" aria-hidden>
                {!currentLiked ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                    <path d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143q.09.083.176.171a3 3 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15"/>
                  </svg>
                ) : (
                  <svg className="filled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--accent-color, #3b7ad1)" />
                        <stop offset="100%" stopColor="var(--primary-color, #4a90e2)" />
                      </linearGradient>
                    </defs>
                    <path
                      fillRule="evenodd"
                      fill={`url(#${gradId})`}
                      d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"
                    />
                  </svg>
                )}
              </span>
              <span className="count">{currentLikes}</span>
            </button>
          </div>

          {/* Header right: sort controls + admin edit/delete + close */}
          <div className="header-right">
            <div className="sort-group" role="group" aria-label="Ưu tiên sắp xếp">
              <button
                className={`sort-pill ${priority === "default" ? "active" : ""}`}
                onClick={() => setPriority("default")}
                title="Ưu tiên Base Fret"
              >
                Default
              </button>
              <button
                className={`sort-pill ${priority === "popularity" ? "active" : ""}`}
                onClick={() => setPriority("popularity")}
                title="Ưu tiên nhiều Likes"
              >
                Likes
              </button>
            </div>

            <div className="mine-wrap" aria-label="Sắp xếp theo thứ tự tim riêng">
              <label className={`mine-toggle ${mineEnabled ? "on" : ""}`}>
                <input
                  type="checkbox"
                  checked={mineEnabled}
                  onChange={(e) => setMineEnabled(e.target.checked)}
                  aria-label="Bật/tắt sắp xếp theo thứ tự thả tim cá nhân"
                />
                <span className="knob" />
                <span className="lbl">Mine</span>
              </label>
              <div className={`mine-dir ${!mineEnabled ? "disabled" : ""}`}>
                <button
                  className={`dir-btn ${mineDir === "asc" ? "active" : ""}`}
                  onClick={() => mineEnabled && setMineDir("asc")}
                  title="Cũ trước (Mine ↑)"
                >
                  ↑
                </button>
                <button
                  className={`dir-btn ${mineDir === "desc" ? "active" : ""}`}
                  onClick={() => mineEnabled && setMineDir("desc")}
                  title="Mới trước (Mine ↓)"
                >
                  ↓
                </button>
              </div>
            </div>

            {admin && (
              <div className="admin-actions" aria-label="Admin actions">
                <button
                  className="icon-btn edit-btn"
                  onClick={() => onEditVoicing?.({ chord: c, variantIndex: currentOriginalIndex })}
                  disabled={!onEditVoicing}
                  aria-label="Edit voicing"
                  title={onEditVoicing ? "Edit voicing này" : "Chưa cấu hình onEditVoicing"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true">
                    <path fill="currentColor" d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/>
                  </svg>
                  <span className="lbl">Edit</span>
                </button>
                <button
                  className="icon-btn danger delete-btn"
                  onClick={() => onDeleteVoicing?.({ chord: c, variantIndex: currentOriginalIndex })}
                  disabled={!onDeleteVoicing}
                  aria-label="Delete voicing"
                  title={onDeleteVoicing ? "Delete voicing này" : "Chưa cấu hình onDeleteVoicing"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true">
                    <path fill="currentColor" d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
                  </svg>
                  <span className="lbl">Delete</span>
                </button>
              </div>
            )}

            <button className="close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        <div className="viewer">
          <div className="carousel" style={{ "--index": index } as React.CSSProperties}>
            {variantsOrdered.map((v, i) => (
              <div className="slide" key={v.id ?? `${i}-${orderedIndices[i]}`}>
                {!isPiano ? (
                  <ChordDiagram
                    shape={{ ...v, name }}
                    numStrings={c.instrument === "guitar" ? 6 : 4}
                    showName={false}
                  />
                ) : (
                  <PianoDiagram notes={[0, 4, 7]} />
                )}
              </div>
            ))}
          </div>
        </div>

        <footer>
          <button disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>←</button>
          <div className="pager">{count > 0 ? index + 1 : 0} / {count}</div>
          <button disabled={index === count - 1 || count === 0} onClick={() => setIndex((i) => Math.min(count - 1, i + 1))}>→</button>
        </footer>
      </div>
    </div>
  );
}
