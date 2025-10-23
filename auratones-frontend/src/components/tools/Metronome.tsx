// src/components/tools/Metronome.tsx
import React, { useState, useRef, useEffect } from "react";
import "../../styles/Metronome.scss";
import TempoModal from "./modals/TempoModal";
import TimeSigModal from "./modals/TimeSigModal";

/* Type nội bộ cho đơn vị nốt */
export type NoteUnit =
  | "1"   // whole
  | "2"   // half
  | "4"   // quarter
  | "8"   // eighth
  | "16"  // sixteenth
  | "32"  // thirty-second
  | "4."  // dotted quarter
  | "8."; // dotted eighth

const Metronome: React.FC = () => {
  /* Tempo canonical: lưu theo BPM của nốt đen (quarter) */
  const [tempoQ, setTempoQ] = useState<number>(120);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isTempoModalOpen, setIsTempoModalOpen] = useState<boolean>(false);
  const [timeSig, setTimeSig] = useState<string>("4/4");
  const [accent, setAccent] = useState<number[]>([3, 1, 2, 1]);

  /* Đơn vị hiển thị & click */
  const [displayUnit, setDisplayUnit] = useState<NoteUnit>("4");
  const [clickUnit, setClickUnit] = useState<NoteUnit>("4");
  const [rotation, setRotation] = useState<number>(0);

  /* UI & input state */
  const [isSigModalOpen, setIsSigModalOpen] = useState<boolean>(false);
  const [tempoInputStr, setTempoInputStr] = useState<string>("120");
  const [tempoInputFresh, setTempoInputFresh] = useState<boolean>(true);
  const [soundType, setSoundType] = useState<"beep" | "square" | "triangle">("beep");

  /* Knob/draggable */
  const knobRef = useRef<HTMLDivElement>(null);
  const prevAngle = useRef<number>(0);
  const [totalRotation, setTotalRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  /* WebAudio timing */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);     // dùng làm "next tick time"
  const nextBeatIndexRef = useRef<number>(0);    // dùng như "tick index trong ô nhịp"
  const schedulerIdRef = useRef<number | null>(null);
  const [currentBeat, setCurrentBeat] = useState<number>(-1);

  /* Refs realtime để tránh stale closure */
  const tempoQRef = useRef<number>(tempoQ);
  const accentRef = useRef<number[]>(accent);
  const clickUnitRef = useRef<NoteUnit>(clickUnit);
  const timeSigRef = useRef<string>(timeSig);

  /* Tap tempo */
  const tapTimesRef = useRef<number[]>([]);

  /* Pendulum */
  const [pendulumSide, setPendulumSide] = useState<-1 | 1>(1);
  const pendulumSideRef = useRef<-1 | 1>(1);

  /* Hằng số timing */
  const scheduleAheadTime = 0.05; // s
  const lookaheadMs = 20;         // ms
  const noteLength = 0.03;        // s
  const latencyFudgeMs = 2;       // ms

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

  // Độ dài tương đối so với quarter (nốt đen) => số "phần tư" của quarter
  const unitLenVsQuarter = (u: NoteUnit): number => {
    switch (u) {
      case "1": return 4;
      case "2": return 2;
      case "4": return 1;
      case "8": return 0.5;
      case "16": return 0.25;
      case "32": return 0.125;
      case "4.": return 1.5;
      case "8.": return 0.75;
      default: return 1;
    }
  };

  // Icon đơn vị
  const unitIcon = (u: NoteUnit) => {
    switch (u) {
      case "1": return "𝅝";
      case "2": return "𝅗𝅥";
      case "4": return "♩";
      case "8": return "♪";
      case "16": return "♬";
      case "32": return "♬♬";
      case "4.": return "♩.";
      case "8.": return "♪.";
      default: return "♩";
    }
  };

  // Chuyển đổi hiển thị tempo với đơn vị hiển thị
  const displayBpm = (tempoQuarter: number, unit: NoteUnit) =>
    Math.round(tempoQuarter / unitLenVsQuarter(unit));
  const toQuarterBpm = (bpmShown: number, unit: NoteUnit) =>
    bpmShown * unitLenVsQuarter(unit);

  const clampTempoQ = (t: number) => Math.max(20, Math.min(300, t));

  // Mẫu số nhịp -> NoteUnit "đơn" (không chấm). Phách = mẫu số.
  const bottomToUnit = (bottomStr: string): NoteUnit => {
    if (bottomStr === "1" || bottomStr === "2" || bottomStr === "4" || bottomStr === "8" || bottomStr === "16" || bottomStr === "32") {
      return bottomStr as NoteUnit;
    }
    return "4";
  };

  // Tick base = 1/32 của quarter để luôn chia được mọi đơn vị (kể cả dotted).
  const BASE_TICK_LEN_Q = 0.125; // = 1/8 quarter = chiều dài của 1 nốt 1/32

  // Tính thông số tick dựa trên timeSig + clickUnit hiện tại.
  const computeGrid = () => {
    const [tsTopStr, tsBottomStr] = (timeSigRef.current || "4/4").split("/");
    const beatsPerBar = Math.max(1, parseInt(tsTopStr || "4", 10));
    const beatUnit: NoteUnit = bottomToUnit(tsBottomStr || "4"); // phách = mẫu số
    const lenBeatQ = unitLenVsQuarter(beatUnit);                 // độ dài 1 phách theo quarter
    const lenClickQ = unitLenVsQuarter(clickUnitRef.current);    // độ dài 1 click theo quarter

    // ticks/beat và ticks/click tính trên lưới 1/32
    const ticksPerBeat = Math.round(lenBeatQ / BASE_TICK_LEN_Q);
    const ticksPerClick = Math.round(lenClickQ / BASE_TICK_LEN_Q);
    const barTicks = beatsPerBar * ticksPerBeat;

    // Thời lượng 1 tick (s) = (60/tempoQ) * BASE_TICK_LEN_Q
    const tickSec = (60.0 / (tempoQRef.current || 60)) * BASE_TICK_LEN_Q;
    // Thời lượng 1 phách (để pendulum mượt)
    const beatSec = tickSec * ticksPerBeat;

    return {
      beatsPerBar,
      beatUnit,
      lenBeatQ,
      lenClickQ,
      ticksPerBeat,
      ticksPerClick,
      barTicks,
      tickSec,
      beatSec,
    };
  };

  /* ======= Effect: sync refs ======= */
  useEffect(() => { tempoQRef.current = tempoQ; }, [tempoQ]);
  useEffect(() => { accentRef.current = accent; }, [accent]);
  useEffect(() => { clickUnitRef.current = clickUnit; }, [clickUnit]);
  useEffect(() => { pendulumSideRef.current = pendulumSide; }, [pendulumSide]);
  useEffect(() => { timeSigRef.current = timeSig; }, [timeSig]);

  /* ======= Time Signature -> accent (theo số phách = tử số) ======= */
  useEffect(() => {
    const beats = parseInt(timeSig.split("/")[0]) || 4;
    let newAccent: number[] = [];
    if (beats === 3) newAccent = [3, 1, 1];
    else if (beats === 4) newAccent = [3, 1, 2, 1];
    else newAccent = Array(beats).fill(1);
    setAccent(newAccent);
    nextBeatIndexRef.current = 0; // reset tick index trong ô nhịp
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
    }

    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + noteLength);

    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + noteLength);
  };

  // Visual/pendulum: chỉ cập nhật ở "phách" (mẫu số) để phù hợp mô tả
  const queueVisualBeat = (beatIndex: number, atTime: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const delayMs = Math.max(0, (atTime - ctx.currentTime) * 1000);
    window.setTimeout(() => {
      setCurrentBeat(beatIndex);
      setPendulumSide((s) => (s === 1 ? -1 : 1));
    }, delayMs);
  };

  // seconds cho 1 TICK (tick base = 1/32 của quarter)
  const tickSeconds = () => computeGrid().tickSec;

  // seconds cho 1 PHÁCH (để UI pendulum)
  const beatSeconds = () => computeGrid().beatSec;

  // seconds cho 1 CLICK (âm thanh), hữu ích cho Tap-resync
  const clickSeconds = () => {
    const g = computeGrid();
    return g.tickSec * g.ticksPerClick;
  };

  // Lập lịch theo TICK base (1/32 quarter) để tổng quát hoá mọi case
  const schedule = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const g = computeGrid();
    while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
      const tickInBar = nextBeatIndexRef.current % Math.max(1, g.barTicks);

      const isVisualBeat = (tickInBar % g.ticksPerBeat) === 0;
      const isClickTime  = (tickInBar % g.ticksPerClick) === 0;

      // Beat index để lấy accent (tăng ở phách, không theo click)
      const beatIndex = Math.floor(tickInBar / g.ticksPerBeat) % Math.max(1, g.beatsPerBar);
      const levelAtBeat = accentRef.current[beatIndex] ?? 1;

      // Click: nếu trúng thời điểm click thì phát audio. Nếu trúng đúng phách -> dùng accent level, ngược lại -> level thường.
      if (isClickTime) {
        const levelForClick = isVisualBeat ? levelAtBeat : 1;
        playClick(nextNoteTimeRef.current, levelForClick);
      }
      // Visual: chỉ nháy ở phách (mẫu số). Đảm bảo pendulum/ô-phách đúng mô tả.
      if (isVisualBeat) {
        queueVisualBeat(beatIndex, nextNoteTimeRef.current);
      }

      nextNoteTimeRef.current += g.tickSec;
      nextBeatIndexRef.current = (tickInBar + 1) % Math.max(1, g.barTicks);
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
      // @ts-expect-error webkit
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new Ctx({ latencyHint: "interactive" });
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") await ctx.resume();

      const g = computeGrid();
      const gesturePerf = performance.now();
      const startAt = ctx.currentTime + 0.0001;

      // Tick 0: Visual-only ở phách đầu tiên (mute click)
      // -> phù hợp UX đếm vào
      queueVisualBeat(0, startAt);
      nextBeatIndexRef.current = 1 % Math.max(1, g.barTicks); // sang tick #1

      const outLatency = (ctx as any).outputLatency ?? 0;
      const baseLat = ctx.baseLatency ?? 0;
      const totalLatency = (outLatency || 0) + (baseLat || 0);
      const fudgeSec = latencyFudgeMs / 1000;

      // căn chỉnh tick thứ 1 theo thời gian thực
      const secondTickCtx =
        perfToCtxTime(ctx, gesturePerf + g.tickSec * 1000) - (totalLatency + fudgeSec);
      nextNoteTimeRef.current = Math.max(secondTickCtx, ctx.currentTime + 0.001);

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

  /* Tap tempo: tính theo displayUnit, rồi quy về quarter BPM như cũ */
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
    const bpmShown = Math.round(60000 / avgMs);
    const nextQ = clampTempoQ(Math.round(toQuarterBpm(bpmShown, displayUnit)));
    setTempoQ(nextQ);

    // Khi đang chạy, dời lịch tick tiếp theo dựa trên clickSeconds() mới
    if (isPlaying && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const outLatency = (ctx as any).outputLatency ?? 0;
      const baseLat = ctx.baseLatency ?? 0;
      const totalLatency = (outLatency || 0) + (baseLat || 0);
      const fudgeSec = latencyFudgeMs / 1000;

      const spcNew = clickSeconds(); // seconds per click
      const nextHeardPerf = now + spcNew * 1000;
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
    setTempoInputFresh(true);
    setIsTempoModalOpen(true);
  };
  const closeTempoModal = () => setIsTempoModalOpen(false);

  /* ======= TimeSig Modal ======= */
  const openSigModal = () => setIsSigModalOpen(true);
  const closeSigModal = () => setIsSigModalOpen(false);

  /* ======= Render ======= */
  const [tsTop, tsBottom] = timeSig.split("/");
  const shownBpm = displayBpm(tempoQ, displayUnit);

  return (
    <div className="metronome">
      {/* Header: Tempo & Signature */}
      <div className="metronome__display">
        <div className="metronome__tempo">
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
            __html: `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='currentColor' viewBox='0 0 16 16'><path fill-rule='evenodd' d='M7.776 5.553a.5.5 0  1 1-.448.894L8 6.56 2.224 9.447a.5.5 0 1 1-.448-.894z'/></svg>`,
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

      {/* Pendulum: duration theo PHÁCH (mẫu số) */}
      <div className="metronome__pendulum">
        <div
          className={`pendulum-arm ${pendulumSide === -1 ? "left" : "right"}`}
          style={{ transitionDuration: `${beatSeconds()}s` }}
        >
          <div className="pendulum-bob" />
        </div>
      </div>

      {/* Accent Bar: số block = tử số; active theo phách */}
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

      {/* Tags */}
      <div className="metronome__note-tag">
        Click unit: <span className="note-chip">{unitIcon(clickUnit)}</span>
        <span className="sep">•</span> Display: <span className="note-chip">{unitIcon(displayUnit)}</span>
      </div>

      {/* TAP */}
      <button
        className="metronome__tap-floating no-select"
        onClick={handleTap}
        aria-label="Tap tempo (phím T)"
        title="Tap tempo (T)"
      >
        TAP
      </button>

      {/* Presets */}
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

      {/* ==== Modals ==== */}
      <TempoModal
        isOpen={isTempoModalOpen}
        onClose={closeTempoModal}
        displayUnit={displayUnit}
        setDisplayUnit={setDisplayUnit}
        tempoInputStr={tempoInputStr}
        setTempoInputStr={setTempoInputStr}
        tempoInputFresh={tempoInputFresh}
        setTempoInputFresh={setTempoInputFresh}
        clampQuarter={clampTempoQ}
        onApplyQuarterBPM={(q) => setTempoQ(q)}
      />

      <TimeSigModal
        isOpen={isSigModalOpen}
        onClose={closeSigModal}
        timeSig={timeSig}
        setTimeSig={setTimeSig}
        clickUnit={clickUnit}
        setClickUnit={setClickUnit}
      />
    </div>
  );
};

export default Metronome;
