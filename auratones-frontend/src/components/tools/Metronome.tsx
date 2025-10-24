import React, { useEffect, useRef, useState } from "react";
import "../../styles/Metronome.scss";
import TempoModal from "./modals/TempoModal";
import TimeSigModal from "./modals/TimeSigModal";

/* Khôi phục nút TAP; giữ nguyên cấu trúc/logic, chỉ bổ sung tối thiểu để đảm bảo hiển thị TAP */

export type NoteUnit = "1" | "2" | "4" | "8" | "16" | "32" | "4." | "8.";

const Metronome: React.FC = () => {
  const [tempoQ, setTempoQ] = useState<number>(120);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isTempoModalOpen, setIsTempoModalOpen] = useState<boolean>(false);
  const [isSigModalOpen, setIsSigModalOpen] = useState<boolean>(false);
  const [timeSig, setTimeSig] = useState<string>("4/4");
  const [accent, setAccent] = useState<number[]>([3, 1, 2, 1]);
  const [displayUnit, setDisplayUnit] = useState<NoteUnit>("4");
  const [clickUnit, setClickUnit] = useState<NoteUnit>("4");
  const [tempoInputStr, setTempoInputStr] = useState<string>("120");
  const [tempoInputFresh, setTempoInputFresh] = useState<boolean>(true);
  const [soundType, setSoundType] = useState<"beep" | "square" | "triangle">("beep");
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [totalRotation, setTotalRotation] = useState<number>(0);

  const knobRef = useRef<HTMLDivElement>(null);
  const prevAngle = useRef<number>(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const nextBeatIndexRef = useRef<number>(0);
  const schedulerIdRef = useRef<number | null>(null);
  const [currentBeat, setCurrentBeat] = useState<number>(-1);

  const tempoQRef = useRef<number>(tempoQ);
  const timeSigRef = useRef<string>(timeSig);
  const accentRef = useRef<number[]>(accent);
  const clickUnitRef = useRef<NoteUnit>(clickUnit);
  const muteFirstClickRef = useRef<boolean>(false);

  const tapTimesRef = useRef<number[]>([]);
  const [pendulumSide, setPendulumSide] = useState<-1 | 1>(1);

  const scheduleAheadTime = 0.05;
  const lookaheadMs = 20;
  const noteLength = 0.03;

  /* Presets nguyên trạng */
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

  /* Refs sync */
  useEffect(() => { tempoQRef.current = tempoQ; }, [tempoQ]);
  useEffect(() => { timeSigRef.current = timeSig; }, [timeSig]);
  useEffect(() => { accentRef.current = accent; }, [accent]);
  useEffect(() => { clickUnitRef.current = clickUnit; }, [clickUnit]);

  /* TimeSig -> accent mặc định */
  useEffect(() => {
    const beats = parseInt(timeSig.split("/")[0], 10) || 4;
    const next = beats === 3 ? [3, 1, 1] : beats === 4 ? [3, 1, 2, 1] : Array(beats).fill(1);
    setAccent(next);
    nextBeatIndexRef.current = 0;
  }, [timeSig]);

  /* Helpers */
  const unitLenVsQuarter = (u: NoteUnit): number => {
    switch (u) {
      case "1": return 4; case "2": return 2; case "4": return 1; case "8": return 0.5;
      case "16": return 0.25; case "32": return 0.125; case "4.": return 1.5; case "8.": return 0.75;
      default: return 1;
    }
  };
  const displayBpm = (tempoQuarter: number, unit: NoteUnit) =>
    Math.round(tempoQuarter / unitLenVsQuarter(unit));
  const toQuarterBpm = (bpmShown: number, unit: NoteUnit) =>
    bpmShown * unitLenVsQuarter(unit);
  const clampTempoQ = (t: number) => Math.max(20, Math.min(300, t));
  const bottomToUnit = (b: string): NoteUnit =>
    (["1","2","4","8","16","32"].includes(b) ? (b as NoteUnit) : "4");

  const BASE_TICK_LEN_Q = 0.125;
  const computeGrid = () => {
    const [topStr, bottomStr] = (timeSigRef.current || "4/4").split("/");
    const beatsPerBar = Math.max(1, parseInt(topStr || "4", 10));
    const beatUnit: NoteUnit = bottomToUnit(bottomStr || "4");
    const lenBeatQ = unitLenVsQuarter(beatUnit);
    const lenClickQ = unitLenVsQuarter(clickUnitRef.current);
    const ticksPerBeat = Math.round(lenBeatQ / BASE_TICK_LEN_Q);
    const ticksPerClick = Math.round(lenClickQ / BASE_TICK_LEN_Q);
    const barTicks = beatsPerBar * ticksPerBeat;
    const tickSec = (60.0 / (tempoQRef.current || 60)) * BASE_TICK_LEN_Q;
    const beatSec = tickSec * ticksPerBeat;
    return { beatsPerBar, ticksPerBeat, ticksPerClick, barTicks, tickSec, beatSec };
  };
  const beatSeconds = () => computeGrid().beatSec;

  /* Knob */
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
      if (stepChange !== 0) setTempoQ((t) => clampTempoQ(t + stepChange));
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

  /* Audio click */
  const playClick = (time: number, level: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx || level === 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    let freq = level === 3 ? 1200 : level === 2 ? 900 : 700;
    let vol  = level === 3 ? 0.6  : level === 2 ? 0.38 : 0.22;
    if (soundType === "square") { osc.type = "square"; freq *= 0.9; }
    else if (soundType === "triangle") { osc.type = "triangle"; vol *= 0.9; }
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + noteLength);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + noteLength);
  };

  /* Visual beat + pendulum */
  const queueVisualBeat = (beatIndex: number, atTime: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const delayMs = Math.max(0, (atTime - ctx.currentTime) * 1000);
    window.setTimeout(() => {
      setCurrentBeat(beatIndex);
      setPendulumSide((s) => (s === 1 ? -1 : 1));
    }, delayMs);
  };

  /* Scheduler */
  const schedule = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const g = computeGrid();
    while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
      const tickInBar = nextBeatIndexRef.current % Math.max(1, g.barTicks);
      const isVisualBeat = (tickInBar % g.ticksPerBeat) === 0;
      const isClickTime  = (tickInBar % g.ticksPerClick) === 0;
      const beatIndex = Math.floor(tickInBar / g.ticksPerBeat) % Math.max(1, g.barTicks / g.ticksPerBeat);
      const levelAtBeat = accentRef.current[beatIndex] ?? 1;

      if (isClickTime) {
        if (muteFirstClickRef.current) {
          muteFirstClickRef.current = false;
        } else {
          playClick(nextNoteTimeRef.current, isVisualBeat ? levelAtBeat : 1);
        }
      }
      if (isVisualBeat) queueVisualBeat(beatIndex, nextNoteTimeRef.current);

      nextNoteTimeRef.current += g.tickSec;
      nextBeatIndexRef.current = (tickInBar + 1) % Math.max(1, g.barTicks);
    }
  };

  /* Play/Pause (fix đứng phách 1) */
  const handlePlayToggle = async () => {
    if (!isPlaying) {
      // @ts-expect-error webkit
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx({ latencyHint: "interactive" });
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") await ctx.resume();

      const startAt = ctx.currentTime + 0.0001;
      muteFirstClickRef.current = true;
      nextBeatIndexRef.current = 0;
      nextNoteTimeRef.current = startAt;
      queueVisualBeat(0, startAt);

      setIsPlaying(true);
      if (schedulerIdRef.current == null) schedulerIdRef.current = window.setInterval(schedule, lookaheadMs);
      schedule();
    } else {
      setIsPlaying(false);
      if (schedulerIdRef.current != null) {
        window.clearInterval(schedulerIdRef.current);
        schedulerIdRef.current = null;
      }
    }
  };

  /* TAP tempo – KHÔI PHỤC NÚT & HÀNH VI */
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
    const nextQ = Math.max(20, Math.min(300, Math.round(toQuarterBpm(bpmShown, displayUnit))));
    setTempoQ(nextQ);
  };

  /* Hotkeys (Space: play/pause, T: tap) */
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

  /* Accent toggle */
  const toggleAccent = (i: number) => {
    const nxt = [...accent];
    nxt[i] = nxt[i] === 3 ? 2 : nxt[i] === 2 ? 1 : nxt[i] === 1 ? 0 : 3;
    setAccent(nxt);
  };

  /* Tempo +/- */
  const adjustTempo = (d: number) => setTempoQ((t) => clampTempoQ(t + d));

  /* Modals */
  const openTempoModal = () => { setTempoInputStr(String(displayBpm(tempoQ, displayUnit))); setTempoInputFresh(true); setIsTempoModalOpen(true); };
  const closeTempoModal = () => setIsTempoModalOpen(false);
  const openSigModal = () => setIsSigModalOpen(true);
  const closeSigModal = () => setIsSigModalOpen(false);

  const [tsTop, tsBottom] = timeSig.split("/");
  const shownBpm = displayBpm(tempoQ, displayUnit);

  return (
    <div className="metronome">
      <div className="metronome__display">
        <div>
          <button className="tempo-display" onClick={openTempoModal}>
            {displayUnit === "4" ? "♩" :
            displayUnit === "8" ? "♪" :
            displayUnit === "2" ? "𝅗𝅥" :
            displayUnit === "16" ? "semi" :
            displayUnit === "4." ? "♩." :
            displayUnit === "8." ? "♪." :
            `𝅝`} = {shownBpm}
          </button>
          <span className="tempo-unit">BPM</span>
        </div>
        <div className="metronome__sig">
          <button className="sig-display" onClick={openSigModal}>{tsTop}/{tsBottom}</button>
        </div>
      </div>

      <div className="metronome__knob-wrapper no-select">
        <button className="metronome__tempo-btn down no-select" onClick={() => adjustTempo(-1)} aria-label="Decrease tempo">−</button>
        <div ref={knobRef} className="metronome__knob no-select" onMouseDown={handleMouseDown}>
          <img src="/button_silver.png" alt="knob" className="metronome__knob-img" style={{ transform: `rotate(${rotation}deg)` }} />
        </div>
        <button className="metronome__tempo-btn up no-select" onClick={() => adjustTempo(+1)} aria-label="Increase tempo">+</button>
      </div>

      <div className="metronome__controls no-select">
        <button
          className={`metronome__play-btn no-select ${isPlaying ? "is-playing" : ""}`}
          onClick={handlePlayToggle}
          aria-label={isPlaying ? "Pause metronome" : "Play metronome"}
        >
          <img src={isPlaying ? "/Pause.png" : "/Play.png"} alt={isPlaying ? "Pause" : "Play"} className="metronome__play-icon" />
        </button>
      </div>

      {/* Pendulum piston (rail + slider) */}
      <div className="metronome__pendulum">
        <div className="pendulum-rail">
          <div className={`pendulum-slider ${pendulumSide === -1 ? "left" : "right"}`} style={{ transitionDuration: `${beatSeconds()}s` }} />
        </div>
      </div>

      <button className="metronome__tap-floating" onClick={handleTap} aria-label="Tap tempo (phím T)">TAP</button>
      <div className="metronome__accent-bar" aria-live="off">
        {accent.map((level, i) => (
          <div
            key={i}
            className={`beat-block level-${level} ${currentBeat === i && isPlaying ? "is-active" : ""}`}
            onClick={() => toggleAccent(i)}
            role="button"
            aria-label={`Beat ${i + 1}`}
          >
            <div className="beat-fill" />
          </div>
        ))}
      </div>
      <select className="metronome__sound-select no-select" value={soundType} onChange={(e) => setSoundType(e.target.value as any)}>
        <option value="beep">Beep</option>
        <option value="square">Square</option>
        <option value="triangle">Triangle</option>
      </select>

      {/* Presets giữ nguyên */}
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
                    <span className="song-meta">{song.tempo} BPM • {song.timeSig}</span>
                  </div>
                  <button
                    className="song-play"
                    onClick={() => { setTempoQ(song.tempo); setTimeSig(song.timeSig); setAccent(song.accent); }}
                    title="Load preset"
                  >
                    ▶
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Modal Tempo */}
      <TempoModal
        isOpen={isTempoModalOpen}
        onClose={closeTempoModal}
        displayUnit={displayUnit}
        setDisplayUnit={setDisplayUnit}
        tempoInputStr={tempoInputStr}
        setTempoInputStr={setTempoInputStr}
        tempoInputFresh={tempoInputFresh}
        setTempoInputFresh={setTempoInputFresh}
        clampQuarter={(q) => Math.max(20, Math.min(300, q))}
        onApplyQuarterBPM={(q) => setTempoQ(q)}
      />
      {/* Modal TimeSig */}
      <TimeSigModal
        isOpen={isSigModalOpen}
        onClose={closeSigModal}
        timeSig={timeSig}
        setTimeSig={setTimeSig}
        clickUnit={clickUnit}
        setClickUnit={setClickUnit}
      />

      {/* TAP tempo – NÚT KHÔI PHỤC */}
    </div>
  );
};

export default Metronome;
