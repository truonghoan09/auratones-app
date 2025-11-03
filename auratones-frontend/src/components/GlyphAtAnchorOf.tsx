// src/components/GlyphAtAnchorOf.tsx
import React from "react";
import { getAnchorSpSafe, getBoxSp } from "../lib/sprite";
import Glyph from "./Glyph";

/**
 * Vẽ glyph B sao cho TÂM của nó trùng một điểm (anchor).
 *
 * Hỗ trợ 2 cách dùng:
 *  A) TUYỆT ĐỐI:
 *     - Truyền atX, atY (px)  => component canh TÂM glyph vào (atX, atY)
 *
 *  B) TỰ TÍNH ANCHOR:
 *     - Truyền anchorOnId, anchor, ownerX, ownerY, spSize, (ownerScale)
 *     - Component sẽ lấy anchor (đơn vị sp) trên glyph A rồi quy ra px.
 *     - Nếu glyph không có anchors (đã bỏ lúc build), tự động fallback về TÂM bbox.
 *
 *  Thuộc tính chung:
 *    - glyphId: id glyph sẽ vẽ (B), spSize, scale, fill
 *    - dxSp/dySp: nudge nhỏ theo sp khi cần tinh chỉnh (tuỳ chọn)
 */
type Props = {
  glyphId: string;
  spSize: number;
  fill?: string;
  scale?: number;

  // --- Cách A (TUYỆT ĐỐI) ---
  atX?: number;
  atY?: number;

  // --- Cách B (TỰ TÍNH) ---
  anchorOnId?: string;
  anchor?: string;
  ownerX?: number;
  ownerY?: number;
  ownerScale?: number;

  // tinh chỉnh nhỏ theo sp (áp dụng cho cách B)
  dxSp?: number;
  dySp?: number;
};

const GlyphAtAnchorOf: React.FC<Props> = (props) => {
  const {
    glyphId,
    spSize,
    fill,
    scale = 1,

    atX,
    atY,

    anchorOnId,
    anchor,
    ownerX,
    ownerY,
    ownerScale = 1,

    dxSp = 0,
    dySp = 0,
  } = props;

  // 1) Lấy bbox glyph B (sp) -> px để canh TÂM
  const { w, h } = getBoxSp(glyphId);
  const pxW = w * spSize * scale;
  const pxH = h * spSize * scale;

  // 2) Tính điểm đích (anchor) trong px theo chế độ
  let targetX: number;
  let targetY: number;

  if (typeof atX === "number" && typeof atY === "number") {
    // --- Cách A: bạn đã tính (atX, atY) sẵn ---
    targetX = atX;
    targetY = atY;
  } else {
    // --- Cách B: tự tính từ anchor của glyph A ---
    if (
      !anchorOnId ||
      !anchor ||
      typeof ownerX !== "number" ||
      typeof ownerY !== "number"
    ) {
      throw new Error(
        "[GlyphAtAnchorOf] Missing params. Provide either (atX, atY) OR (anchorOnId, anchor, ownerX, ownerY)."
      );
    }

    // Dùng getAnchorSpSafe: nếu không có anchors, fallback = "center" (tâm bbox của glyph A)
    const a = getAnchorSpSafe(anchorOnId, anchor, "center"); // {x,y} in sp của symbol A
    targetX = ownerX + (a.x + dxSp) * spSize * ownerScale;
    targetY = ownerY + (a.y + dySp) * spSize * ownerScale;
  }

  // 3) Đặt TÂM glyph B trùng target
  const placeX = targetX - pxW / 2;
  const placeY = targetY - pxH / 2;

  return (
    <Glyph
      id={glyphId}
      x={placeX}
      y={placeY}
      spSize={spSize}
      fill={fill}
      scale={scale}
    />
  );
};

export default GlyphAtAnchorOf;
