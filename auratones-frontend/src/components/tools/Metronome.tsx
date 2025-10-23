// src/components/tools/Metronome.tsx
import React, { useState, useRef, useEffect } from "react";
import "../../styles/Metronome.scss";

type NoteUnit =
  | "1"   // whole
  | "2"   // half
  | "4"   // quarter
  | "8"   // eighth
  | "16"  // sixteenth
  | "32"  // thirty-second
  | "4."  // dotted quarter
  | "8."; // dotted eighth

const Metronome: React.FC = () => {
  /* Canonical tempo lưu theo BPM của nốt đen (quarter). UI sẽ map qua đơn vị hiển thị/click. */
  const [tempoQ, setTempoQ] = useState<number>(120);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isTempoModalOpen, setIsTempoModalOpen] = useState<boolean>(false);
  const [timeSig, setTimeSig] = useState<string>("4/4");
  const [accent, setAccent] = useState<number[]>([3, 1, 2, 1]);

  /* Note units */
  const [displayUnit, setDisplayUnit] = useState<NoteUnit>("4"); // đơn vị hiển thị/nhập (ví dụ ♩=120)
  const [clickUnit, setClickUnit] = useState<NoteUnit>("4");     // đơn vị gõ thực tế (subdivision)
  const [rotation, setRotation] = useState<number>(0);

  /* UI & input state */
  const [isSigModalOpen, setIsSigModalOpen] = useState<boolean>(false);
  const [tempoInputStr, setTempoInputStr] = useState<string>("120");   // chuỗi nhập modal tempo (theo displayUnit)
  const [tempoInputFresh, setTempoInputFresh] = useState<boolean>(true); // nhập số đầu sẽ reset
  const [soundType, setSoundType] = useState<"beep" | "square" | "triangle">("beep"); // placeholder switch sound

  /* Knob/draggable */
  const knobRef = useRef<HTMLDivElement>(null);
  const prevAngle = useRef<number>(0);
  const [totalRotation, setTotalRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  /* WebAudio timing */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const nextBeatIndexRef = useRef<number>(0);
  const schedulerIdRef = useRef<number | null>(null);
  const [currentBeat, setCurrentBeat] = useState<number>(-1);

  /* Refs realtime để tránh stale closure */
  const tempoQRef = useRef<number>(tempoQ);
  const accentRef = useRef<number[]>(accent);
  const clickUnitRef = useRef<NoteUnit>(clickUnit);

  /* Tap tempo */
  const tapTimesRef = useRef<number[]>([]);

  /* Pendulum */
  const [pendulumSide, setPendulumSide] = useState<-1 | 1>(1); // -1 trái, 1 phải
  const pendulumSideRef = useRef<-1 | 1>(1);

  /* Hằng số timing */
  const scheduleAheadTime = 0.05; // s
  const lookaheadMs = 20;         // ms
  const noteLength = 0.03;        // s
  const latencyFudgeMs = 2;       // ms (bù sớm)

  const [presets] = useState<any[]>([
    {
      folder: "Show 12/5",
      songs: [
        { name: "Niệm Khúc Cuối", tempo: 80, timeSig: "3/4", accent: [3, 1, 1] },
        { name: "Anh Còn Nợ Em", tempo: 92, timeSig: "4/4", accent: [3, 1, 2, 1] },
        { name: "Thu Cuối", tempo: 100, timeSig: "4/4", accent: [3, 1, 2, 1] },
      ],
    },
  ]);

  /* ======= Helpers: note & tempo mapping ======= */

  /* Tỉ lệ độ dài so với nốt đen (quarter). Ví dụ "8" = 0.5 (nửa nốt đen), "4." = 1.5. */
  const unitLenVsQuarter = (u: NoteUnit): number => {
    switch (u) {
      case "1": return 4;     // whole = 4 quarters
      case "2": return 2;     // half  = 2 quarters
      case "4": return 1;     // quarter
      case "8": return 0.5;   // eighth
      case "16": return 0.25; // sixteenth
      case "32": return 0.125;// thirty-second
      case "4.": return 1.5;  // dotted quarter = 3/8 = 1.5 quarters
      case "8.": return 0.75; // dotted eighth  = 3/16
      default: return 1;
    }
  };

  /* BPM hiển thị theo displayUnit từ BPM quarter canonical */
  const displayBpm = (tempoQuarter: number, unit: NoteUnit) =>
    Math.round(tempoQuarter / unitLenVsQuarter(unit));

  /* Chuyển BPM hiển thị về BPM quarter canonical */
  const toQuarterBpm = (bpmShown: number, unit: NoteUnit) =>
    bpmShown * unitLenVsQuarter(unit);

  /* Icon đơn vị nốt cho UI */
  const unitIcon = (u: NoteUnit) => {
    switch (u) {
      case "1": return "𝅝";   // whole (symbol approximation)
      case "2": return "𝅗𝅥";   // half
      case "4": return "♩";   // quarter
      case "8": return "♪";   // eighth
      case "16": return "♬";  // sixteenth (approx)
      case "32": return "♬♬"; // thirty-second (approx)
      case "4.": return "♩."; // dotted quarter
      case "8.": return "♪."; // dotted eighth
      default: return "♩";
    }
  };

  const clampTempoQ = (t: number) => Math.max(20, Math.min(300, t)); // clamp theo quarter BPM

  /* ======= Effect: sync refs ======= */
  useEffect(() => { tempoQRef.current = tempoQ; }, [tempoQ]);
  useEffect(() => { accentRef.current = accent; }, [accent]);
  useEffect(() => { clickUnitRef.current = clickUnit; }, [clickUnit]);
  useEffect(() => { pendulumSideRef.current = pendulumSide; }, [pendulumSide]);

  /* ======= Time Signature -> accent ======= */
  useEffect(() => {
    const beats = parseInt(timeSig.split("/")[0]) || 4;
    let newAccent: number[] = [];
    if (beats === 3) newAccent = [3, 1, 1];
    else if (beats === 4) newAccent = [3, 1, 2, 1];
    else newAccent = Array(beats).fill(1);
    setAccent(newAccent);
    nextBeatIndexRef.current = 0;
  }, [timeSig]);

  /* ======= Knob ======= */
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = knobRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    prevAngle.current = Math.atan2(dy, dx) * (180 / Math.PI);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !knobRef.current) return;
    const rect = knobRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    let delta = currentAngle - prevAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    prevAngle.current = currentAngle;
    setRotation((r) => r + delta);
    setTotalRotation((r) => {
      const newRot = r + delta;
      const stepChange = Math.floor(newRot / 3.6) - Math.floor(r / 3.6);
      if (stepChange !== 0) {
        setTempoQ((t) => clampTempoQ(t + stepChange));
      }
      return newRot;
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  /* ======= Audio ======= */
  const playClick = (time: number, level: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx || level === 0) return;

    /* Switch sound placeholder: khác waveform/biên độ theo soundType */
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    let freq = level === 3 ? 1200 : level === 2 ? 900 : 700;
    let vol  = level === 3 ? 0.6  : level === 2 ? 0.38 : 0.22;

    if (soundType === "square") {
      osc.type = "square";
      freq *= 0.9;
    } else if (soundType === "triangle") {
      osc.type = "triangle";
      vol *= 0.9;
    } // "beep" = default sine

    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + noteLength);

    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + noteLength);
  };

  const queueVisual = (beatIndex: number, atTime: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const delayMs = Math.max(0, (atTime - ctx.currentTime) * 1000);
    window.setTimeout(() => {
      setCurrentBeat(beatIndex);
      setPendulumSide((s) => (s === 1 ? -1 : 1)); // đổi hướng mỗi click
    }, delayMs);
  };

  /* Khoảng giữa các click theo clickUnit (subdivision) từ BPM quarter */
  const clickSeconds = () => {
    const spbQuarter = 60.0 / (tempoQRef.current || 60);
    return spbQuarter * unitLenVsQuarter(clickUnitRef.current);
  };

  const schedule = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const spb = clickSeconds();
    const pattern = accentRef.current;
    while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
      const bi = nextBeatIndexRef.current % Math.max(1, pattern.length);
      const level = pattern[bi] ?? 1;
      playClick(nextNoteTimeRef.current, level);
      queueVisual(bi, nextNoteTimeRef.current);
      nextNoteTimeRef.current += spb;
      nextBeatIndexRef.current = (bi + 1) % Math.max(1, pattern.length);
    }
  };

  const perfToCtxTime = (ctx: AudioContext, perfMs: number) => {
    const ts = (ctx as any).getOutputTimestamp?.();
    if (ts && typeof ts.contextTime === "number" && typeof ts.performanceTime === "number") {
      return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
    }
    const snapPerf = performance.now();
    const snapCtx = ctx.currentTime;
    return snapCtx + (perfMs - snapPerf) / 1000;
  };

  const handlePlayToggle = async () => {
    if (!isPlaying) {
      if (!audioCtxRef.current) {
        // @ts-expect-error webkit
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new Ctx({ latencyHint: "interactive" });
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") await ctx.resume();

      const spb = clickSeconds();
      const gesturePerf = performance.now();
      const startAt = ctx.currentTime + 0.0001;

      /* Click #1 mute (visual-only) */
      playClick(startAt, 0);
      queueVisual(0, startAt);
      nextBeatIndexRef.current = 1 % Math.max(1, accentRef.current.length);

      /* Bù latency + fudge cho beat #2 */
      const outLatency = (ctx as any).outputLatency ?? 0;
      const baseLat = ctx.baseLatency ?? 0;
      const totalLatency = (outLatency || 0) + (baseLat || 0);
      const fudgeSec = latencyFudgeMs / 1000;

      const secondBeatCtx =
        perfToCtxTime(ctx, gesturePerf + spb * 1000) - (totalLatency + fudgeSec);
      nextNoteTimeRef.current = Math.max(secondBeatCtx, ctx.currentTime + 0.001);

      setIsPlaying(true);

      if (schedulerIdRef.current == null) {
        schedulerIdRef.current = window.setInterval(schedule, lookaheadMs);
      }
      schedule();
    } else {
      setIsPlaying(false);
      if (schedulerIdRef.current != null) {
        window.clearInterval(schedulerIdRef.current);
        schedulerIdRef.current = null;
      }
    }
  };

  /* Tap tempo (theo displayUnit): cập nhật tempoQ & retime */
  const handleTap = () => {
    const now = performance.now();
    const arr = tapTimesRef.current;
    if (arr.length && now - arr[arr.length - 1] > 2000) arr.length = 0;
    arr.push(now);
    if (arr.length > 8) arr.shift();
    if (arr.length < 2) return;

    const dts: number[] = [];
    for (let i = 1; i < arr.length; i++) {
      const dt = arr[i] - arr[i - 1];
      if (dt >= 150 && dt <= 2000) dts.push(dt);
    }
    if (!dts.length) return;

    const avgMs = dts.reduce((a, b) => a + b, 0) / dts.length;
    const bpmShown = Math.round(60000 / avgMs); // theo displayUnit
    const nextQ = clampTempoQ(Math.round(toQuarterBpm(bpmShown, displayUnit)));
    setTempoQ(nextQ);

    if (isPlaying && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const outLatency = (ctx as any).outputLatency ?? 0;
      const baseLat = ctx.baseLatency ?? 0;
      const totalLatency = (outLatency || 0) + (baseLat || 0);
      const fudgeSec = latencyFudgeMs / 1000;
      const spbNew = (60.0 / nextQ) * unitLenVsQuarter(clickUnitRef.current);
      const nextHeardPerf = now + spbNew * 1000;
      const scheduleAt = perfToCtxTime(ctx, nextHeardPerf) - (totalLatency + fudgeSec);
      nextNoteTimeRef.current = Math.max(scheduleAt, ctx.currentTime + 0.001);
    }
  };

  /* Hotkeys */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || (e.target as HTMLElement)?.isContentEditable;
      if (isTyping) return;

      if (e.code === "Space") { e.preventDefault(); handlePlayToggle(); }
      else if (e.key === "t" || e.key === "T") { e.preventDefault(); handleTap(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlaying]);

  /* Cleanup */
  useEffect(() => {
    return () => {
      if (schedulerIdRef.current != null) {
        window.clearInterval(schedulerIdRef.current);
        schedulerIdRef.current = null;
      }
    };
  }, []);

  /* Accent cycle */
  const toggleAccent = (index: number) => {
    const nextLevel = (lvl: number) => (lvl === 3 ? 2 : lvl === 2 ? 1 : lvl === 1 ? 0 : 3);
    const updated = [...accent];
    updated[index] = nextLevel(updated[index]);
    setAccent(updated);
  };

  /* Tempo +/- 1 quarter BPM */
  const adjustTempo = (delta: number) => setTempoQ((t) => clampTempoQ(t + delta));

  /* ======= Tempo Modal (nhập theo displayUnit) ======= */
  const openTempoModal = () => {
    setTempoInputStr(String(displayBpm(tempoQ, displayUnit)));
    setTempoInputFresh(true); // nhập số đầu sẽ reset
    setIsTempoModalOpen(true);
  };
  const closeTempoModal = () => setIsTempoModalOpen(false);
  const handleTempoInput = (num: number) => {
    setTempoInputStr((prev) => {
      const base = (tempoInputFresh ? "" : prev);
      const raw = `${base}${num}`.replace(/^0+(?=\d)/, "");
      setTempoInputFresh(false);
      return raw.slice(0, 3);
    });
  };
  const handleTempoDelete = () => {
    setTempoInputStr((s) => (s.length ? s.slice(0, -1) : ""));
    setTempoInputFresh(false);
  };
  const handleTempoClearAll = () => {
    setTempoInputStr("");
    setTempoInputFresh(true);
  };
  const handleTempoSet = () => {
    const val = Math.max(1, Math.min(999, Number(tempoInputStr || "0")));
    const q = clampTempoQ(Math.round(toQuarterBpm(val, displayUnit)));
    setTempoQ(q);
    closeTempoModal();
  };

  /* ======= TimeSig/Unit Modal ======= */
  const openSigModal = () => setIsSigModalOpen(true);
  const closeSigModal = () => setIsSigModalOpen(false);

  const tops = Array.from({ length: 16 }, (_, i) => String(i + 1)); // 1..16
  const bottoms: NoteUnit[] = ["1", "2", "4", "8", "16", "32"];

  /* Apply chọn trong modal TS & Units */
  const applySigAndUnits = (top: string, bottom: NoteUnit, clickU: NoteUnit, displayU: NoteUnit) => {
    setTimeSig(`${top}/${bottom}`);
    setClickUnit(clickU);
    setDisplayUnit(displayU);
    /* Không đổi tempoQ (canonical), UI sẽ tự map hiển thị & scheduler click theo clickUnit */
  };

  /* ======= Render ======= */
  const [tsTop, tsBottom] = timeSig.split("/");
  const shownBpm = displayBpm(tempoQ, displayUnit);

  return (
    <div className="metronome">
      {/* Header: Tempo & Signature + nút mở modal TS/Units */}
      <div className="metronome__display">
        <div className="metronome__tempo">
          {/* Hiển thị theo đơn vị đã chọn: ♪ = 120 */}
          <button className="tempo-display" onClick={openTempoModal} title="Set tempo">
            {unitIcon(displayUnit)} = {shownBpm}
          </button>
          <span className="tempo-unit">BPM</span>
        </div>

        <div className="metronome__sig">
          <button className="sig-display" onClick={openSigModal} title="Time signature & Units">
            {tsTop}/{tsBottom} • click:{unitIcon(clickUnit)} • disp:{unitIcon(displayUnit)}
          </button>
        </div>
      </div>

      {/* Knob + Tempo +/- */}
      <div className="metronome__knob-wrapper no-select">
        <button
          className="metronome__tempo-btn down no-select"
          onClick={() => adjustTempo(-1)}
          aria-label="Decrease tempo"
          dangerouslySetInnerHTML={{
            __html: `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' viewBox='0 0 16 16'><path fill-rule='evenodd' d='M1.553 6.776a.5.5 0 0 1 .67-.223L8 9.44l5.776-2.888a.5.5 0 1 1 .448.894l-6 3a.5.5 0 0 1-.448 0l-6-3a.5.5 0 0 1-.223-.67'/></svg>`,
          }}
        />
        <div
          ref={knobRef}
          className="metronome__knob no-select"
          onMouseDown={handleMouseDown}
        >
          <img
            src="/button_silver.png"
            alt="knob"
            className="metronome__knob-img"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>
        <button
          className="metronome__tempo-btn up no-select"
          onClick={() => adjustTempo(+1)}
          aria-label="Increase tempo"
          dangerouslySetInnerHTML={{
            __html: `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' viewBox='0 0 16 16'><path fill-rule='evenodd' d='M7.776 5.553a.5.5 0 0 1 .448 0l6 3a.5.5 0 1 1-.448.894L8 6.56 2.224 9.447a.5.5 0 1 1-.448-.894z'/></svg>`,
          }}
        />
      </div>

      {/* Play + Sound switch */}
      <div className="metronome__controls no-select">
        <button
          className={`metronome__play-btn no-select ${isPlaying ? "is-playing" : ""}`}
          onClick={handlePlayToggle}
          aria-label={isPlaying ? "Pause metronome" : "Play metronome"}
        >
          <img
            src={isPlaying ? "/Pause.png" : "/Play.png"}
            alt={isPlaying ? "Pause" : "Play"}
            className="metronome__play-icon"
          />
        </button>

        {/* Sound switch (placeholder cho future update sample) */}
        <select
          className="metronome__sound-select no-select"
          value={soundType}
          onChange={(e) => setSoundType(e.target.value as any)}
          title="Sound"
        >
          <option value="beep">Beep</option>
          <option value="square">Square</option>
          <option value="triangle">Triangle</option>
        </select>
      </div>

      {/* Pendulum (đồng bộ theo click) */}
      <div className="metronome__pendulum">
        <div
          className={`pendulum-arm ${pendulumSide === -1 ? "left" : "right"}`}
          style={{ transitionDuration: `${clickSeconds()}s` }}
        >
          <div className="pendulum-bob" />
        </div>
      </div>

      {/* Accent Bar */}
      <div className="metronome__accent-bar" aria-live="off">
        {accent.map((level, i) => (
          <div
            key={i}
            className={`beat-block level-${level} ${currentBeat === i && isPlaying ? "is-active" : ""}`}
            onClick={() => toggleAccent(i)}
            aria-label={`Beat ${i + 1}${currentBeat === i && isPlaying ? " (đang ở beat này)" : ""}`}
            role="button"
          >
            <div className="beat-fill" />
          </div>
        ))}
      </div>

      {/* Thể hiện dạng nốt đang gõ (clickUnit) */}
      <div className="metronome__note-tag">
        Click unit: <span className="note-chip">{unitIcon(clickUnit)}</span>
        <span className="sep">•</span> Display: <span className="note-chip">{unitIcon(displayUnit)}</span>
      </div>

      {/* TAP floating (góc dưới phải) */}
      <button
        className="metronome__tap-floating no-select"
        onClick={handleTap}
        aria-label="Tap tempo (phím T)"
        title="Tap tempo (T)"
      >
        TAP
      </button>

      {/* Preset List (nguyên trạng) */}
      <div className="metronome__presets">
        <h4>Preset Playlist</h4>
        {presets.map((folder, fi) => (
          <div key={fi} className="preset-folder">
            <div className="folder-title">{folder.folder}</div>
            <ul className="song-list">
              {folder.songs.map((song: any, si: number) => (
                <li key={si} className="song-item">
                  <div className="song-info">
                    <span className="song-name">{song.name}</span>
                    <span className="song-meta">
                      {song.tempo} BPM • {song.timeSig}
                    </span>
                  </div>
                  <button className="song-play">▶</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Tempo Modal (nhập theo displayUnit) */}
      {isTempoModalOpen && (
        <div className="metronome__modal">
          <div className="modal-backdrop" onClick={closeTempoModal}></div>
          <div className="modal-content">
            <div className="modal-title">Set Tempo</div>
            <div className="modal-subtitle">{unitIcon(displayUnit)} = BPM</div>
            <div className="modal-display">{tempoInputStr || "—"}</div>
            <div className="modal-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                <button key={n} onClick={() => handleTempoInput(n)}>{n}</button>
              ))}
              <button onClick={handleTempoDelete}>⌫</button>
              <button onClick={handleTempoClearAll}>AC</button>
              <button className="set-btn" onClick={handleTempoSet}>SET</button>
            </div>
          </div>
        </div>
      )}

      {/* Time Signature & Units Modal */}
      {isSigModalOpen && (
        <div className="metronome__modal">
          <div className="modal-backdrop" onClick={closeSigModal}></div>
          <div className="modal-content sig">
            <div className="modal-title">Time Signature & Units</div>

            <div className="sig-row">
              <div className="sig-col">
                <div className="label">Upper (beats per bar)</div>
                <div className="grid grid-top">
                  {tops.map((t) => (
                    <button
                      key={t}
                      className={t === tsTop ? "is-selected" : ""}
                      onClick={() => setTimeSig(`${t}/${tsBottom}`)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sig-col">
                <div className="label">Lower (note value)</div>
                <div className="grid grid-bottom">
                  {bottoms.map((b) => (
                    <button
                      key={b}
                      className={b === tsBottom ? "is-selected" : ""}
                      onClick={() => setTimeSig(`${tsTop}/${b}`)}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sig-row">
              <div className="sig-col">
                <div className="label">Click unit</div>
                <div className="grid grid-unit">
                  {(["1","2","4","8","16","32","4.","8."] as NoteUnit[]).map((u) => (
                    <button
                      key={u}
                      className={u === clickUnit ? "is-selected" : ""}
                      onClick={() => setClickUnit(u)}
                      title={`Click: ${unitIcon(u)}`}
                    >
                      {unitIcon(u)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sig-col">
                <div className="label">Display unit</div>
                <div className="grid grid-unit">
                  {(["1","2","4","8","16","32","4.","8."] as NoteUnit[]).map((u) => (
                    <button
                      key={u}
                      className={u === displayUnit ? "is-selected" : ""}
                      onClick={() => setDisplayUnit(u)}
                      title={`Display: ${unitIcon(u)}`}
                    >
                      {unitIcon(u)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sig-actions">
              <button
                className="set-btn"
                onClick={() => {
                  applySigAndUnits(tsTop!, tsBottom as NoteUnit, clickUnit, displayUnit);
                  closeSigModal();
                }}
              >
                APPLY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Metronome;
