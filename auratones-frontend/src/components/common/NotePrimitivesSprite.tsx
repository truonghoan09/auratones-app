//src/components/common/NotePrimitivesSprite.tsx
// Sprite primitives cho trình biên tập sheet: tách head/stem/flag/beam/dot.
// - Mount 1 lần ở root (cạnh NoteIconSprite). Không ảnh hưởng layout (width/height=0).
// - Quy ước hệ tọa độ: viewBox="0 0 1000 1000" (UPM 1000).
// - Gốc neo:
//    • notehead-*: tâm tại (350, 500). Chiều rộng ~ 540, chiều cao ~ 380 (chuẩn SMuFL gần đúng).
//    • stem: hình chữ nhật 90×700, neo đáy tại (620, 500) → vươn lên (stem up). Sẽ xoay/flip khi cần.
//    • flag-8/16/32: neo tại đỉnh stem (x≈665, y≈-200) theo chuẩn up/right; sẽ flip/mirror bằng transform.
//    • beam-unit: dải ngang 1000×120 (ngang chuẩn), dùng <use> lặp và offset theo beams.
//    • dot: tròn r=55, neo cạnh phải notehead tại (650, 500).
import React from "react";

export const NOTE_PRIM_SYMBOLS = {
  HEAD_FILLED: "noteprim-head-filled",
  HEAD_HOLLOW: "noteprim-head-hollow",
  STEM: "noteprim-stem",
  FLAG_8: "noteprim-flag-8",
  FLAG_16: "noteprim-flag-16",
  FLAG_32: "noteprim-flag-32",
  BEAM_UNIT: "noteprim-beam-unit",
  DOT: "noteprim-dot",
} as const;

export type NotePrimId = typeof NOTE_PRIM_SYMBOLS[keyof typeof NOTE_PRIM_SYMBOLS];

export default function NotePrimitivesSprite(): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* notehead filled (quarter/eighth/…): ellipse nghiêng nhẹ */}
        <symbol id={NOTE_PRIM_SYMBOLS.HEAD_FILLED} viewBox="0 0 1000 1000">
          <g transform="translate(350 500) rotate(-12)">
            <ellipse cx="0" cy="0" rx="270" ry="190" fill="currentColor" />
          </g>
        </symbol>

        {/* notehead hollow (whole/half): ellipse viền + lỗ trong */}
        <symbol id={NOTE_PRIM_SYMBOLS.HEAD_HOLLOW} viewBox="0 0 1000 1000">
          <g transform="translate(350 500) rotate(-12)">
            <ellipse cx="0" cy="0" rx="270" ry="190" fill="none" stroke="currentColor" strokeWidth="70" />
          </g>
        </symbol>

        {/* stem mặc định (up, bên phải head). Size & neo để dễ ráp. */}
        <symbol id={NOTE_PRIM_SYMBOLS.STEM} viewBox="0 0 1000 1000">
          <rect x="620" y="-200" width="90" height="700" fill="currentColor" />
        </symbol>

        {/* flags mặc định: up + bên phải; sẽ flip/mirror bằng transform ở component */}
        <symbol id={NOTE_PRIM_SYMBOLS.FLAG_8} viewBox="0 0 1000 1000">
          <path
            d="M700 -200
               C 900 -260, 930 -70, 760 30
               C 660 85, 640 120, 700 190
               C 770 270, 950 260, 980 140
               C 1010 20, 900 -120, 740 -160 Z"
            fill="currentColor"
          />
        </symbol>

        <symbol id={NOTE_PRIM_SYMBOLS.FLAG_16} viewBox="0 0 1000 1000">
          <use href={`#${NOTE_PRIM_SYMBOLS.FLAG_8}`} />
          <path
            d="M700 0
               C 900 -60, 930 130, 760 230
               C 660 285, 640 320, 700 390
               C 770 470, 950 460, 980 340
               C 1010 220, 900 80, 740 40 Z"
            fill="currentColor"
          />
        </symbol>

        <symbol id={NOTE_PRIM_SYMBOLS.FLAG_32} viewBox="0 0 1000 1000">
          <use href={`#${NOTE_PRIM_SYMBOLS.FLAG_16}`} />
          <path
            d="M700 200
               C 900 140, 930 330, 760 430
               C 660 485, 640 520, 700 590
               C 770 670, 950 660, 980 540
               C 1010 420, 900 280, 740 240 Z"
            fill="currentColor"
          />
        </symbol>

        {/* dải beam cơ bản: 1000×120, bo nhẹ; lặp và offset theo số beam */}
        <symbol id={NOTE_PRIM_SYMBOLS.BEAM_UNIT} viewBox="0 0 1000 1000">
          <rect x="0" y="0" width="1000" height="120" rx="40" ry="40" fill="currentColor" />
        </symbol>

        {/* dot: đặt cạnh phải head */}
        <symbol id={NOTE_PRIM_SYMBOLS.DOT} viewBox="0 0 1000 1000">
          <circle cx="650" cy="500" r="55" fill="currentColor" />
        </symbol>
      </defs>
    </svg>
  );
}
