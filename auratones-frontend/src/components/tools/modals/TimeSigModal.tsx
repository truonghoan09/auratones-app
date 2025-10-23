// src/components/tools/modals/TimeSigModal.tsx
import React from "react";
import "../../../styles/TimeSigModal.scss";

export type NoteUnit = "1" | "2" | "4" | "8" | "16" | "32" | "4." | "8.";

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

interface TimeSigModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeSig: string;
  setTimeSig: (s: string) => void;
  clickUnit: NoteUnit;
  setClickUnit: (u: NoteUnit) => void;
}

const TimeSigModal: React.FC<TimeSigModalProps> = ({
  isOpen,
  onClose,
  timeSig,
  setTimeSig,
  clickUnit,
  setClickUnit,
}) => {
  if (!isOpen) return null;

  const [tsTop, tsBottom] = timeSig.split("/");
  const tops = Array.from({ length: 16 }, (_, i) => String(i + 1));
  const bottoms: NoteUnit[] = ["1", "2", "4", "8", "16", "32"];

  return (
    <div className="metronome__modal">
      <div className="modal-backdrop" onClick={onClose}></div>
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

        {/* Click unit (Display unit nằm ở TempoModal) */}
        <div className="sig-row">
          <div className="sig-col">
            <div className="label">Click unit</div>
            <div className="grid grid-unit">
              {((["1","2","4","8","16","32","4.","8."] as NoteUnit[])).map((u) => (
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
        </div>

        <div className="sig-actions">
          <button className="set-btn" onClick={onClose}>APPLY</button>
        </div>
      </div>
    </div>
  );
};

export default TimeSigModal;
