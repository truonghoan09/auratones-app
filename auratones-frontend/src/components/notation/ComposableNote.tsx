// Nốt lắp ráp từ primitives (head/stem/flag/beam/dot) phục vụ editor sheet.
// - Không thay đổi logic nơi khác; chỉ bổ sung viewBox rộng để không bị cắt.
// - Hệ tọa độ primitives: 0..1000; stem/flag có toạ độ âm → cần viewBox mở rộng để không clip.
import React from "react";
import { NOTE_PRIM_SYMBOLS } from "../common/NotePrimitivesSprite";

type Duration = "1" | "2" | "4" | "8" | "16" | "32";
type HeadKind = "filled" | "hollow";

export interface ComposableNoteProps extends Omit<React.SVGProps<SVGSVGElement>, "color"> {
  duration: Duration;              // 1,2,4,8,16,32
  head: HeadKind;                  // filled (black) | hollow (white)
  stemDirection?: "up" | "down" | "none";
  flagSide?: "auto" | "left" | "right";  // với 8/16/32; auto theo stemDirection
  beams?: number | "auto";         // 0..3 hoặc "auto" theo duration (8->1,16->2,32->3)
  dotted?: boolean;                // chấm dôi
  width?: number;                  // size hiển thị
  height?: number;
  color?: string;                  // mặc định currentColor
}

/* map duration -> số beam mặc định */
const defaultBeams = (d: Duration): number => {
  if (d === "32") return 3;
  if (d === "16") return 2;
  if (d === "8") return 1;
  return 0;
};

/* chọn symbol flag theo số beam (>=1) */
const flagSymbolByBeams = (n: number) => {
  if (n >= 3) return NOTE_PRIM_SYMBOLS.FLAG_32;
  if (n === 2) return NOTE_PRIM_SYMBOLS.FLAG_16;
  return NOTE_PRIM_SYMBOLS.FLAG_8;
};

const HEAD_SYMBOL: Record<HeadKind, string> = {
  filled: NOTE_PRIM_SYMBOLS.HEAD_FILLED,
  hollow: NOTE_PRIM_SYMBOLS.HEAD_HOLLOW,
};

/* ViewBox mở rộng để không bị cắt stem/flag khi lật/rotate.
   - primitives dùng y từ -200..700; khi flip xuống có thể lệch biên.
   - dư buffer để stroke không bị clip. */
const VIEWBOX = "-500 -500 2000 2000";

const ComposableNote: React.FC<ComposableNoteProps> = ({
  duration,
  head,
  stemDirection = "up",           // mặc định stem lên
  flagSide = "auto",
  beams = "auto",
  dotted = false,
  width = 36,
  height = 36,
  color = "currentColor",
  style,
  ...svgProps
}) => {
  const beamCount = beams === "auto" ? defaultBeams(duration) : Math.max(0, Math.min(3, Number(beams)));

  // whole không stem
  const stemEnabled = stemDirection !== "none" && duration !== "1";
  const needFlag = stemEnabled && beamCount > 0;

  // cờ: trái/phải theo stem nếu auto
  const resolvedFlagSide =
    flagSide === "auto" ? (stemDirection === "up" ? "right" : "left") : flagSide;

  // stem: symbol mặc định là "up" → nếu "down" thì lật dọc quanh tâm viewBox 1000x1000
  const stemTransform =
    stemDirection === "up" ? "" : "scale(1,-1) translate(0,-1000)";

  // flag: mặc định up/right → mirror theo side + flip theo stem
  const flagMirrorX = resolvedFlagSide === "left" ? "scale(-1,1) translate(-1000,0)" : "";
  const flagMirrorY = stemDirection === "down" ? "scale(1,-1) translate(0,-1000)" : "";
  const flagTransform = [flagMirrorX, flagMirrorY].filter(Boolean).join(" ");

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={width}
      height={height}
      viewBox={VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "inline-block", verticalAlign: "middle", color, ...style }}
      {...svgProps}
    >
      {/* notehead */}
      <use href={`#${HEAD_SYMBOL[head]}`} xlinkHref={`#${HEAD_SYMBOL[head]}`} />

      {/* stem (ẩn cho whole hoặc khi tắt) */}
      {stemEnabled && (
        <use
          href={`#${NOTE_PRIM_SYMBOLS.STEM}`}
          xlinkHref={`#${NOTE_PRIM_SYMBOLS.STEM}`}
          transform={stemTransform}
        />
      )}

      {/* flag (tương ứng số beam) */}
      {needFlag && (
        <use
          href={`#${flagSymbolByBeams(beamCount)}`}
          xlinkHref={`#${flagSymbolByBeams(beamCount)}`}
          transform={flagTransform}
        />
      )}

      {/* dot (đặt cạnh phải head) */}
      {dotted && (
        <use href={`#${NOTE_PRIM_SYMBOLS.DOT}`} xlinkHref={`#${NOTE_PRIM_SYMBOLS.DOT}`} />
      )}
    </svg>
  );
};

export default ComposableNote;
