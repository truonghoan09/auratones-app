// src/components/GlyphAtAnchorOf.tsx
import React from "react";
import { getAnchorSpSafe, getBoxSp } from "../lib/sprite";
import Glyph from "./Glyph";

type Props = {
  glyphId: string;
  spSize: number;
  fill?: string;
  scale?: number;

  // Cách A: anchor tuyệt đối
  atX?: number;
  atY?: number;

  // Cách B: tự tính từ anchor glyph A
  anchorOnId?: string;
  anchor?: string;
  ownerX?: number;
  ownerY?: number;
  ownerScale?: number;

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

  // 1) Bbox glyph B (sp)
  const { w, h } = getBoxSp(glyphId);

  // Scale vẽ thực tế: có thể lớn hơn scale gốc nếu là dot.
  let drawScale = scale;

  // Nếu là dấu chấm augmentation, đảm bảo kích thước tối thiểu cho dễ nhìn.
  if (glyphId === "metAugmentationDot") {
    const baseW = w * spSize * scale;
    const baseH = h * spSize * scale;
    const minPx = 8;
    const factor = Math.max(
      baseW > 0 ? minPx / baseW : 1,
      baseH > 0 ? minPx / baseH : 1,
      1
    );
    drawScale = scale * factor;
  }

  const pxW = w * spSize * drawScale;
  const pxH = h * spSize * drawScale;

  // 2) Tính điểm đích (anchor) theo chế độ
  let targetX: number;
  let targetY: number;

  if (typeof atX === "number" && typeof atY === "number") {
    // Cách A: anchor tuyệt đối
    targetX = atX;
    targetY = atY;
  } else {
    // Cách B: từ anchor glyph A
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

    // Nếu không có anchor cụ thể, fallback về "center" của glyph A
    const a = getAnchorSpSafe(anchorOnId, anchor, "center"); // {x,y} in sp
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
      scale={drawScale}
    />
  );
};

export default GlyphAtAnchorOf;
