// src/components/tools/TempoModal.tsx
import React from "react";
import "../../../styles/TempoModal.scss";
import { NoteIcon } from "../../common/NoteIcon";

/* Only half / quarter / eighth + dotted modifier (dot is a toggle) */
export type NoteUnit = "1" | "2" | "4" | "8" | "16" | "32" | "2." | "4." | "8.";

/* Ratios vs quarter (kept as-is for downstream logic) */
const unitLenVsQuarter = (u: NoteUnit): number => {
  switch (u) {
    case "1":  return 4;
    case "2":  return 2;
    case "4":  return 1;
    case "8":  return 0.5;
    case "16": return 0.25;
    case "32": return 0.125;
    case "2.": return 3;
    case "4.": return 1.5;
    case "8.": return 0.75;
    default:   return 1;
  }
};

/* Labels used in titles/tooltips */
const unitLabel = (u: NoteUnit): string => {
  switch (u) {
    case "2":  return "half";
    case "4":  return "quarter";
    case "8":  return "eighth";
    case "2.": return "half (dotted)";
    case "4.": return "quarter (dotted)";
    case "8.": return "eighth (dotted)";
    default:   return "quarter";
  }
};

/* Compose icon for subtitle using existing NoteIcon wrapper */
const unitIcon = (u: NoteUnit) => {
  const base = (u.startsWith("2") ? "half" : u.startsWith("8") ? "eighth" : "quarter") as
    | "half" | "quarter" | "eighth";
  const dotted = u.endsWith(".");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <NoteIcon name={base} width={28} height={28} />
      {dotted && <NoteIcon name="dot" width={10} height={10} />}
    </span>
  );
};

const toQuarterBpm = (bpmShown: number, unit: NoteUnit) =>
  bpmShown * unitLenVsQuarter(unit);

interface TempoModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayUnit: NoteUnit;
  setDisplayUnit: (u: NoteUnit) => void;
  tempoInputStr: string;
  setTempoInputStr: React.Dispatch<React.SetStateAction<string>>;
  tempoInputFresh: boolean;
  setTempoInputFresh: React.Dispatch<React.SetStateAction<boolean>>;
  clampQuarter: (t: number) => number;
  onApplyQuarterBPM: (quarterBpm: number) => void;
}

/* Dot modifier helpers */
const isDotted = (u: NoteUnit) => u.endsWith(".");
const baseOf = (u: NoteUnit): "2" | "4" | "8" =>
  (u.startsWith("2") ? "2" : u.startsWith("8") ? "8" : "4");
const applyDot = (base: "2" | "4" | "8", dotted: boolean): NoteUnit =>
  (dotted ? (base + ".") : base) as NoteUnit;

const TempoModal: React.FC<TempoModalProps> = ({
  isOpen,
  onClose,
  displayUnit,
  setDisplayUnit,
  tempoInputStr,
  setTempoInputStr,
  tempoInputFresh,
  setTempoInputFresh,
  clampQuarter,
  onApplyQuarterBPM,
}) => {
  if (!isOpen) return null;

  /* keypad handlers (unchanged) */
  const handleTempoInput = (num: number) => {
    setTempoInputStr((prev) => {
      const base = tempoInputFresh ? "" : prev;
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

  const handleSet = () => {
    const val = Math.max(1, Math.min(999, Number(tempoInputStr || "0")));
    const q = clampQuarter(Math.round(toQuarterBpm(val, displayUnit)));
    onApplyQuarterBPM(q);
    onClose();
  };

  /* Unit selection: 3 base buttons + 1 dot toggle (dot cannot stand alone) */
  const baseUnits: Array<"2" | "4" | "8"> = ["2", "4", "8"];
  const currentBase = baseOf(displayUnit);
  const dotted = isDotted(displayUnit);

  const handleClickBase = (b: "2" | "4" | "8") => {
    setDisplayUnit(applyDot(b, dotted));
  };
  const handleToggleDot = () => {
    setDisplayUnit(applyDot(currentBase, !dotted));
  };

  /* Square compact buttons; center icon; reuse NoteIcon so sprite mounting stays consistent */
  const btnSq: React.CSSProperties = {
    width: 34,
    height: 34,
    padding: 0,
    borderRadius: 8,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div className="metronome__modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content tempo">
        <div className="modal-title">Set Tempo</div>

        {/* Display Unit */}
        <div className="unit-section">
          <div className="label">Display unit</div>
          <div className="grid grid-unit">
            {baseUnits.map((u) => (
              <button
                key={u}
                className={u === currentBase ? "is-selected" : ""}
                onClick={() => handleClickBase(u)}
                title={`Display: ${unitLabel(u as NoteUnit)}`}
                style={btnSq}
              >
                {/* Use existing NoteIcon names that your app already supports */}
                {u === "2" && <NoteIcon name="half" width={22} height={22} />}
                {u === "4" && <NoteIcon name="quarter" width={22} height={22} />}
                {u === "8" && <NoteIcon name="eighth" width={22} height={22} />}
              </button>
            ))}
            <button
              key="dot"
              className={dotted ? "is-selected" : ""}
              onClick={handleToggleDot}
              title="Display: dotted"
              style={btnSq}
            >
              <NoteIcon name="dot" width={10} height={10} />
            </button>
          </div>
        </div>

        <div className="modal-subtitle">{unitIcon(displayUnit)} = BPM</div>
        <div className="modal-display">{tempoInputStr || "—"}</div>
        <div className="modal-grid">
          {[1,2,3,4,5,6,7,8,9,0].map((n) => (
            <button key={n} onClick={() => handleTempoInput(n)}>{n}</button>
          ))}
          <button onClick={handleTempoDelete}>⌫</button>
          <button onClick={handleTempoClearAll}>AC</button>
          <button className="set-btn" onClick={handleSet}>SET</button>
        </div>
      </div>
    </div>
  );
};

export default TempoModal;
