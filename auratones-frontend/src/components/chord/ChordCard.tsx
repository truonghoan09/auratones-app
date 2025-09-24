// src/components/chord/ChordCard.tsx

import React from "react";
import ChordDiagram from "./ChordDiagram";
import type { ChordShape } from "../../types/chord";
import "../../styles/ChordCard.scss";

type Props = {
  shape: ChordShape;
  onPick?: (shape: ChordShape) => void;
};

const ChordCard: React.FC<Props> = ({ shape, onPick }) => {
  return (
    <div className="chord-card">
      <ChordDiagram shape={shape} size={100} />
      <div className="chord-card__info">
        {shape.comment && (
          <div className="chord-card__comment">{shape.comment}</div>
        )}
        <button className="chord-card__btn" onClick={() => onPick?.(shape)}>
          Dùng voicing này
        </button>
      </div>
    </div>
  );
};

export default ChordCard;
