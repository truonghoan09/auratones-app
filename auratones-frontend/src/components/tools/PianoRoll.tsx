// src/components/tools/PianoRoll.tsx
import React from "react";
import DebugStaff from "../DebugStaff";
import Crosshair from "../Crosshair";
import Glyph from "../Glyph";
import GlyphAtAnchorOf from "../GlyphAtAnchorOf";
import { getAnchorSp } from "../../lib/sprite";
import { getSpriteMetrics } from "../../lib/spriteMetrics";
import NoteIconTile from "../../assets/NoteIconTile";
import { layoutNoteAtCenter } from "../../engraving/layout/NoteLayout";

const PianoRoll: React.FC = () => {
  const W = 800;
  const H = 300;

  // Staff demo
  const staffTop = 80;
  const sp = 20; // 1 staff-space = 20px (trùng với metrics.staffSpacePx)

  // Ví dụ: nốt nằm trên dòng giữa (bạn có thể chỉnh tuỳ ý)
  const centerX = 200;
  const centerY = staffTop + 2 * sp;

  // Layout 1 nốt: eighth note + dotted
  const note = layoutNoteAtCenter(200, 120, "eighth", true);

  console.log("NOTE LAYOUT:", note);
  
  return (
    <div style={{ backgroundColor: "gray" }}>
      <div style={{backgroundColor: "gray", marginBottom: 16, display: "flex", gap: 8 }}>
        <NoteIconTile
          symbolId="metNote8thUp"
          frameSize={35}
          scale={0.9}
          ariaLabel="Eighth note up"
        />
        <NoteIconTile
          symbolId="note8thDown"
          frameSize={35}
          scale={0.9}
          ariaLabel="Eighth note down"
        />
      </div>

      <svg width={W} height={H}>
        <rect x={0} y={0} width={W} height={H} fill="#555" />

        {note.components.map((c, i) => (
          <Glyph
            key={i}
            id={c.id}
            x={c.x}
            y={c.y}
            spSize={20}
            scale={c.scale}
            fill="#fff"
          />
        ))}
      </svg>
    </div>
  );
};

export default PianoRoll;

//  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
//         <rect x={0} y={0} width={W} height={H} fill="#2b2f3a" />
//
//         <DebugStaff x={80} y={staffTop} width={W - 160} lineGap={lineGap} />
//
//         {/* Crosshair tại anchor dot (hiện giờ trùng tâm head vì chưa có anchor thật) */}
//         <Crosshair x={dotAnchorAbsX} y={dotAnchorAbsY} />
//
//         {/* Notehead */}
//         <Glyph
//           id="noteheadBlack"
//           x={headX}
//           y={headY}
//           spSize={spSize}
//           scale={headScale}
//         />
//
//         {/* Dot: glyph metAugmentationDot, dịch sang phải dotOffsetSp sp */}
//         <GlyphAtAnchorOf
//           glyphId="metAugmentationDot"
//           anchorOnId="noteheadBlack"
//           anchor="dot"
//           ownerX={headX}
//           ownerY={headY}
//           ownerScale={headScale}
//           spSize={spSize}
//           dxSp={dotOffsetSp}
//         />
//       </svg>
