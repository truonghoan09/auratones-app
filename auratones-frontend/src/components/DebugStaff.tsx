//src/components/DebugStaff.tsx

import React from "react";

type Props = {
  x?: number;
  y?: number;
  width: number;
  lineGap?: number;   // px giữa các dòng
  opacity?: number;
};

const DebugStaff: React.FC<Props> = ({ x = 0, y = 0, width, lineGap = 14, opacity = 0.25 }) => {
  const lines = Array.from({ length: 5 }, (_, i) => y + i * lineGap);
  return (
    <g opacity={opacity}>
      {lines.map((ly, i) => (
        <line key={i} x1={x} x2={x + width} y1={ly} y2={ly} stroke="#9aa3b2" strokeWidth={1} />
      ))}
    </g>
  );
};

export default DebugStaff;
