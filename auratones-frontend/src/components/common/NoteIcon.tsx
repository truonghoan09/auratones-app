import React from "react";

/**
 * Wrapper <svg> cho <symbol> trong NoteIconSprite.
 * Không override fill/stroke để tránh bị CSS ngoài làm icon trong suốt.
 */
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;            // "quarter" | "noteicon-quarter" | ...
  viewBox?: string;        // optional override
}

export const NoteIcon: React.FC<IconProps> = ({
  name,
  width = 32,
  height = 32,
  viewBox,
  style,
  ...props
}) => {
  const symbolId = name.startsWith("noteicon-") ? name : `noteicon-${name}`;
  const refPath = `#${symbolId}`;
  const vb = viewBox || "0 0 512 512";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={width}
      height={height}
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        overflow: "hidden", // dùng hidden thay vì visible để clip đúng
        ...style,
      }}
      {...props}
    >
      <use href={refPath} xlinkHref={refPath} width="100%" height="100%" />
    </svg>

  );
};

export default NoteIcon;
