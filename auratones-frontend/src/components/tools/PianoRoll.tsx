// src/components/tools/PianoRoll.tsx
// Mode B: component auto-computes anchors; head size & dot spacing scale automatically.

import React, { useState } from "react";
import DebugStaff from "../DebugStaff";
import Crosshair from "../Crosshair";
import Glyph from "../Glyph";
import GlyphAtAnchorOf from "../GlyphAtAnchorOf";
// import { getAnchorSp } from "../../lib/sprite"; // ❌ gây lỗi: module không export getAnchorSp
import { getSpriteMetrics } from "../../lib/spriteMetrics";
import { NoteIcon } from "../common/NoteIcon"; // thêm để hiển thị icon tempo unit
import NoteIconTile from "../../assets/NoteIconTile";

// ✅ Định dạng mới: đọc anchor/gap từ tokens.json
//    (đường dẫn theo cây thư mục bạn gửi: src/assets/sprite/tokens.json)
import spriteTokensRaw from "../../assets/sprite/tokens.json";

// Kiểu đơn giản cho tokens (nếu schema có thêm field khác cũng không ảnh hưởng)
type SpriteTokens = Record<
  string,
  {
    anchors?: Record<
      string,
      {
        x: number; // toạ độ anchor theo đơn vị "sp" tương đối trong bounding box glyph
        y: number;
        gapSp?: number; // khoảng cách mặc định (nếu có) để đặt glyph phụ (vd: dấu chấm)
      }
    >;
  }
>;
const spriteTokens = spriteTokensRaw as SpriteTokens;

// --- Shim theo định dạng mới: lấy anchor từ tokens.json ---
type AnchorName = "center" | "dot";
type Anchor = { x: number; y: number };

const getAnchorSp = (glyphId: string, anchor: AnchorName): Anchor => {
  const a = spriteTokens[glyphId]?.anchors?.[anchor];
  if (a && Number.isFinite(a.x) && Number.isFinite(a.y)) return { x: a.x, y: a.y };
  // Fallback an toàn nếu thiếu tokens
  if (anchor === "dot") return { x: 1.0, y: 0.5 };
  return { x: 0.5, y: 0.5 };
};

// Lấy khoảng cách “mặc định” (ở đơn vị sp) giữa anchor và dấu chấm từ tokens.json.
// Nếu tokens không có, dùng giá trị kinh nghiệm 0.35sp (tuỳ theo font có thể chênh nhẹ).
const getSpriteDotGapSp = (ownerGlyphId: string, anchor: AnchorName): number => {
  const gap = spriteTokens[ownerGlyphId]?.anchors?.[anchor]?.gapSp;
  return Number.isFinite(gap as number) ? (gap as number) : 0.35;
};

// --- Tempo unit type (giống bên TempoModal) ---
type NoteUnit = "1" | "2" | "4" | "8" | "16" | "32" | "2." | "4." | "8.";

/* Hệ số tỉ lệ so với quarter */
const unitLenVsQuarter = (u: NoteUnit): number => {
  switch (u) {
    case "1": return 4;
    case "2": return 2;
    case "4": return 1;
    case "8": return 0.5;
    case "16": return 0.25;
    case "32": return 0.125;
    case "2.": return 3;
    case "4.": return 1.5;
    case "8.": return 0.75;
    default: return 1;
  }
};

/* Biểu tượng hiển thị đơn vị nốt */
const unitIcon = (u: NoteUnit) => {
  const base = (u.startsWith("2") ? "half" : u.startsWith("8") ? "eighth" : "quarter") as
    | "half" | "quarter" | "eighth";
  const dotted = u.endsWith(".");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <NoteIcon name={base} width={28} height={28} />
      {dotted && <NoteIcon name="dot" width={10} height={10} />}
    </span>
  );
};

const PianoRoll: React.FC = () => {
  // --- State test tempo unit & BPM ---
  const [displayUnit, setDisplayUnit] = useState<NoteUnit>("4");
  const [bpm, setBpm] = useState<number>(120);

  // --- Canvas constants ---
  const W = 1024, H = 420;
  const spSize = 24;
  const staffTop = 90;
  const lineGap = spSize;
  const padPerSideSp = 0.05;

  // --- 1. Compute head scale automatically from real path height ---
  //    Vẫn dùng getSpriteMetrics (đọc từ sprite.svg), không thay đổi logic scale.
  const { pathHSp } = getSpriteMetrics("noteheadBlack");
  const targetHeadPathHeightSp = 1 - 2 * padPerSideSp;
  const headScale = targetHeadPathHeightSp / pathHSp;

  // --- 2. Compute position (center of staff middle) ---
  const centerY = staffTop + 2.5 * lineGap;
  const centerX = 380;

  // Anchor-based placement (đọc anchor từ tokens.json)
  const c = getAnchorSp("noteheadBlack", "center");
  const headX = centerX - c.x * spSize * headScale;
  const headY = centerY - c.y * spSize * headScale;

  // --- 3. Compute correct dot offset --- (định dạng mới)
  //    spriteGapSp lấy từ tokens.json (nếu có); desiredDotGapSp vẫn theo logic cũ.
  const spriteGapSp = getSpriteDotGapSp("noteheadBlack", "dot");
  const desiredDotGapSp = 0.50;
  const dxSp = (desiredDotGapSp / headScale) - spriteGapSp;

  // Debug: anchor “dot” position (for crosshair)
  const dA = getAnchorSp("noteheadBlack", "dot");
  const atX = headX + dA.x * spSize * headScale;
  const atY = headY + dA.y * spSize * headScale;

  // --- Handlers for test UI ---
  const baseUnits: Array<"2" | "4" | "8"> = ["2", "4", "8"];
  const isDotted = (u: NoteUnit) => u.endsWith(".");
  const baseOf = (u: NoteUnit): "2" | "4" | "8" =>
    (u.startsWith("2") ? "2" : u.startsWith("8") ? "8" : "4");
  const applyDot = (base: "2" | "4" | "8", dotted: boolean): NoteUnit =>
    (dotted ? (base + ".") : base) as NoteUnit;

  const currentBase = baseOf(displayUnit);
  const dotted = isDotted(displayUnit);

  const handleClickBase = (b: "2" | "4" | "8") => {
    setDisplayUnit(applyDot(b, dotted));
  };
  const handleToggleDot = () => {
    setDisplayUnit(applyDot(currentBase, !dotted));
  };

  // --- Tốc độ tính theo quarter ---
  const quarterBpm = bpm * unitLenVsQuarter(displayUnit);

  return (
    <div>
      <NoteIconTile symbolId="metNote8thUp" frameSize={35} scale={0.9} />

      --- UI test tempo unit & bpm ---
      {/* <div style={{ marginBottom: 16, color: "#ddd", fontFamily: "monospace" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>Display unit:</div>
          {baseUnits.map((u) => (
            <button
              key={u}
              onClick={() => handleClickBase(u)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: u === currentBase ? "2px solid #7af" : "1px solid #555",
                background: "#333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {u === "2" && <NoteIcon name="half" width={18} height={18} />}
              {u === "4" && <NoteIcon name="quarter" width={18} height={18} />}
              {u === "8" && <NoteIcon name="eighth" width={18} height={18} />}
            </button>
          ))}
          <button
            onClick={handleToggleDot}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: dotted ? "2px solid #7af" : "1px solid #555",
              background: "#333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <NoteIcon name="dot" width={8} height={8} />
          </button>

          <div style={{ marginLeft: 20 }}>
            {unitIcon(displayUnit)} = {bpm} BPM → Quarter = {Math.round(quarterBpm)} BPM
          </div>
        </div>
      </div> */}
    </div>
  );
};

export default PianoRoll;


// {/* --- Canvas render --- */}
// <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
//   <rect x="0" y="0" width={W} height={H} fill="#2b2f3a" />

//   <DebugStaff x={80} y={staffTop} width={W - 160} lineGap={lineGap} />
//   <Crosshair x={atX} y={atY} />

//   {/* Head scaled automatically */}
//   <Glyph id="noteheadBlack" x={headX} y={headY} spSize={spSize} scale={headScale} />

//   {/* Dot anchored, fixed gap in sp */}
//   <GlyphAtAnchorOf
//     glyphId="metAugDot"
//     anchorOnId="noteheadBlack"
//     anchor="dot"
//     ownerX={headX}
//     ownerY={headY}
//     ownerScale={headScale}
//     spSize={spSize}
//     dxSp={dxSp}
//   />
// </svg>
