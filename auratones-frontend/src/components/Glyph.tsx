// src/components/Glyph.tsx
// Render một sprite <symbol> theo id với scale đúng theo bbox_sp.

import React from "react";
import { getBoxSp } from "../lib/sprite";

type GlyphProps = {
  id: string;
  x: number;
  y: number;
  spSize?: number;   // px per staff-space
  scale?: number;    // additional scale factor
  fill?: string;
};

const Glyph: React.FC<GlyphProps> = ({
  id,
  x,
  y,
  spSize = 10,
  scale = 1,
  fill = "#fff",
}) => {
  // bbox_sp của glyph trong đơn vị staff-space
  const box = getBoxSp(id);

  const width = box.w * spSize * scale;
  const height = box.h * spSize * scale;

  return (
    <use
      href={`#${id}`}
      xlinkHref={`#${id}`}  // fallback cũ cho một số browser
      x={x}
      y={y}
      width={width}
      height={height}
      style={{ fill, stroke: "none" }}
    />
  );
};

export default Glyph;
