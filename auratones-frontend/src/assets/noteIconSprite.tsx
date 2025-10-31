//src/asset/noteIconSprite.tsx
import { useMemo } from "react";
import spriteRaw from "./sprite/sprite.svg?raw";

export default function NoteIconSprite() {
  const spriteMarkup = useMemo(() => ({ __html: spriteRaw }), []);

  return (
    <div>
      {/* Nhúng sprite <symbol> đúng cách, ẩn và không ảnh hưởng layout */}
      <svg
        aria-hidden
        focusable="false"
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        dangerouslySetInnerHTML={spriteMarkup}
      />

      {/* Demo khung 320x120px với nền tối */}
      <svg width={320} height={120} viewBox="0 0 320 120">
        <rect x="0" y="0" width="320" height="120" fill="#2b2f3a" />

        {/* Khuyến nghị set CẢ width & height để các trình duyệt scale nhất quán */}
        <use
          href="#metNoteQuarterUp"
          xlinkHref="#metNoteQuarterUp"
          x={10}
          y={20}
          width={80}   // thêm
          height={80}
          style={{ fill: "#fff", stroke: "none" }}
        />
        <use
          href="#metNote8thUp"
          xlinkHref="#metNote8thUp"
          x={160}
          y={20}
          width={80}   // thêm
          height={80}
          style={{ fill: "#fff", stroke: "none" }}
          
        />
        <use
          href="#metAugDot"
          xlinkHref="#metAugDot"
          x={245}
          y={48}
          width={18}   // thêm
          height={18}
          style={{ fill: "#fff", stroke: "none" }}
        />
      </svg>
    </div>
  );
}
