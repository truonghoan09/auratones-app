//src/asset/NoteIconTile.tsx
import React, { useMemo } from "react";
import spriteRaw from "./sprite/sprite.svg?raw";

export type NoteIconTileProps = {
  /** ID của <symbol> trong sprite, ví dụ: "metNoteQuarterUp", "metNote8thUp", "metAugDot" */
  symbolId: string;
  /** Hệ số scale cho icon (mặc định = 1). */
  scale?: number;
  /** Màu fill của nốt (mặc định = "#fff"). */
  fill?: string;
  /** Màu nền của tile (mặc định = "#2b2f3a"). */
  background?: string;
  /** Kích thước khung (px) — khung vuông, mặc định = 96. */
  frameSize?: number;
  /** Bo góc khung (px), mặc định = 12. */
  radius?: number;
  /** Có nhúng sprite defs ẩn trong DOM hay không (true = nhúng), nên render ít nhất 1 lần ở app. */
  includeSpriteDefs?: boolean;
  /** aria-label cho mục đích truy cập */
  ariaLabel?: string;
  /** Thêm style ngoài cho thẻ <svg> khung (tuỳ chọn) */
  style?: React.CSSProperties;
  /** onClick / handler khác nếu muốn ô này tương tác */
  onClick?: React.MouseEventHandler<SVGSVGElement>;
};

const DEFAULT_FRAME = 96;
const DEFAULT_ICON_BASE = 64;

/**
 * NoteIconTile
 * - Render MỘT nốt nhạc trong khung cố định, canh giữa theo cả 2 chiều.
 * - Lấy glyph từ sprite qua <use href="#{symbolId}">.
 * - Quy mô icon theo `scale` (mặc định = 1).
 * - Có thể dùng làm button/icon tương tác.
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
  // Nhúng sprite <symbol> ẩn. Bạn có thể render component này 1 lần ở root để tránh lặp lại.
  const spriteMarkup = useMemo(() => ({ __html: spriteRaw }), []);

  // Tính kích thước icon (width/height) dựa trên base cố định và scale
  const iconSize = Math.max(0, DEFAULT_ICON_BASE * scale);

  // Canh giữa icon trong khung vuông
  const x = (frameSize - iconSize) / 2;
  const y = (frameSize - iconSize) / 2;

  return (
    <div style={{ display: "inline-block", lineHeight: 0 }}>
      {includeSpriteDefs && (
        <svg
          aria-hidden
          focusable="false"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
          // sprite.svg chứa các <symbol id="..."> mà ta sẽ <use>
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
        {/* Nền khung */}
        <rect
          x={0}
          y={0}
          width={frameSize}
          height={frameSize}
          rx={radius}
          ry={radius}
          fill={background}
        />

        {/* Nốt nhạc canh giữa, scale bằng width/height */}
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

/**
 * (Tuỳ chọn) Component chỉ để nhúng sprite defs một lần ở cấp cao (App/Layout)
 * Nếu bạn dùng nhiều NoteIconTile và không muốn lặp lại defs, render <NoteSpriteDefs/> ở root.
 */
export function NoteSpriteDefs() {
  const spriteMarkup = useMemo(() => ({ __html: spriteRaw }), []);
  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      dangerouslySetInnerHTML={spriteMarkup}
    />
  );
}
