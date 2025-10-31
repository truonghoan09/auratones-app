//src/components/Crosshair.tsx

import React from "react";

const Crosshair: React.FC<{ x: number; y: number; size?: number; opacity?: number }> = ({
  x, y, size = 8, opacity = 0.5
}) => (
  <g opacity={opacity}>
    <line x1={x - size} x2={x + size} y1={y} y2={y} stroke="#66d9ef" strokeWidth={1}/>
    <line x1={x} x2={x} y1={y - size} y2={y + size} stroke="#66d9ef" strokeWidth={1}/>
  </g>
);

export default Crosshair;
