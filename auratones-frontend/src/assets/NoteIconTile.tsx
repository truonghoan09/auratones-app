// src/assets/NoteIconTile.tsx
import React, { useMemo } from "react";
import spriteRaw from "../engraving/sprite/sprite.svg?raw";

export type NoteIconTileProps = {
  symbolId: string;
  scale?: number;
  fill?: string;
  background?: string;
  frameSize?: number;
  radius?: number;
  includeSpriteDefs?: boolean;
  ariaLabel?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<SVGSVGElement>;
};

const DEFAULT_FRAME = 96;
const DEFAULT_ICON_BASE = 64;

/**
 * NoteIconTile
 * - Render một glyph trong khung cố định, canh giữa theo cả 2 chiều.
 * - Lấy glyph từ sprite qua <use href="#{symbolId}">.
 */
export default function NoteIconTile({
  symbolId,
  scale = 1,
  fill = "#fff",
  background = "#2b2f3a",
  frameSize = DEFAULT_FRAME,
  radius = 12,
  includeSpriteDefs = true,
  ariaLabel,
  style,
  onClick,
}: NoteIconTileProps) {
  const spriteMarkup = useMemo(() => ({ __html: spriteRaw }), []);

  const iconSize = Math.max(0, DEFAULT_ICON_BASE * scale);
  const x = (frameSize - iconSize) / 2;
  const y = (frameSize - iconSize) / 2;

  return (
    <div style={{ display: "inline-block", lineHeight: 0 }}>
      {includeSpriteDefs && (
        <svg
          aria-hidden
          focusable="false"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
          dangerouslySetInnerHTML={spriteMarkup}
        />
      )}

      <svg
        role="img"
        aria-label={ariaLabel ?? symbolId}
        width={frameSize}
        height={frameSize}
        viewBox={`0 0 ${frameSize} ${frameSize}`}
        style={{
          cursor: onClick ? "pointer" : "default",
          userSelect: "none",
          display: "block",
          ...style,
        }}
        onClick={onClick}
      >
        <rect
          x={0}
          y={0}
          width={frameSize}
          height={frameSize}
          rx={radius}
          ry={radius}
          fill={background}
        />

        <use
          href={`#${symbolId}`}
          xlinkHref={`#${symbolId}`}
          x={x}
          y={y}
          width={iconSize}
          height={iconSize}
          style={{ fill, stroke: "none" }}
        />
      </svg>
    </div>
  );
}
