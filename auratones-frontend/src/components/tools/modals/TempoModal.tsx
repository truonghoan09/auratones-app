// src/components/tools/modals/TempoModal.tsx
import React from "react";
import "../../../styles/TempoModal.scss";

/* Note: đồng bộ với Metronome nhưng độc lập module */
export type NoteUnit = "1" | "2" | "4" | "8" | "16" | "32" | "4." | "8.";

/* Map độ dài so với quarter (canonical) */
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

const toQuarterBpm = (bpmShown: number, unit: NoteUnit) =>
  bpmShown * unitLenVsQuarter(unit);

interface TempoModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayUnit: NoteUnit;
  setDisplayUnit: (u: NoteUnit) => void;
  /* cho phép setState style functional updater */
  tempoInputStr: string;
  setTempoInputStr: React.Dispatch<React.SetStateAction<string>>;
  tempoInputFresh: boolean;
  setTempoInputFresh: React.Dispatch<React.SetStateAction<boolean>>;
  clampQuarter: (t: number) => number;
  onApplyQuarterBPM: (quarterBpm: number) => void;
}

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

  // keypad handlers (giữ logic tương đương)
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

  return (
    <div className="metronome__modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content tempo">
        <div className="modal-title">Set Tempo</div>

        {/* Display Unit */}
        <div className="unit-section">
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
