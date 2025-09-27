import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChordShape, Instrument } from "../../types/chord";
import { useAuthContext } from "../../contexts/AuthContext";
import "../../styles/ChordModal.scss"; // tái dùng style modal đã có

type Props = {
  isOpen: boolean;
  defaultInstrument?: Instrument; // "guitar" | "ukulele" | "piano" (piano tạm disable editor)
  onClose: () => void;
  onSubmit: (payload: {
    instrument: Instrument;
    symbol: string;
    variants: ChordShape[]; // ít nhất 1 shape
    visibility: "system" | "private" | "contribute";
  }) => void;
};

// tham số dựng cần đàn
const MAX_FRETS = 15;
const VB_W = 920;
const VB_H = 500;
const SAFE_X = 16;
const SAFE_Y = 14;

function cleanSymbol(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export default function ChordEditorDialog({
  isOpen,
  defaultInstrument = "guitar",
  onClose,
  onSubmit,
}: Props) {
  const { user } = useAuthContext();
  const role: "admin" | "user" = (user?.role as any) === "admin" ? "admin" : "user";

  const [instrument, setInstrument] = useState<Instrument>(defaultInstrument);
  const [symbol, setSymbol] = useState<string>("C");
  const [baseFret, setBaseFret] = useState<number>(1);
  const [numFrets, setNumFrets] = useState<number>(5);

  // số dây theo instrument
  const numStrings = instrument === "ukulele" ? 4 : instrument === "guitar" ? 6 : 0;

  // mảng frets: -1 mute, 0 open, >0 bấm tại ngăn (tính từ baseFret)
  const [frets, setFrets] = useState<number[]>(
    numStrings ? new Array(numStrings).fill(0) : []
  );
  // fingers (1..4), không bắt buộc
  const [fingers, setFingers] = useState<Array<0 | 1 | 2 | 3 | 4>>(
    numStrings ? new Array(numStrings).fill(0) as any : []
  );
  // root string (1..N) tùy chọn
  const [rootString, setRootString] = useState<number | undefined>(undefined);
  // barres
  const [barres, setBarres] = useState<
    Array<{ fret: number; from: number; to: number; finger?: number }>
  >([]);

  // reset khi đổi nhạc cụ
  useEffect(() => {
    if (!numStrings) return;
    setFrets(new Array(numStrings).fill(0));
    setFingers(new Array(numStrings).fill(0) as any);
    setRootString(undefined);
    setBarres([]);
    setBaseFret(1);
    setNumFrets(5);
  }, [numStrings]);

  // ===== Editor logic (SVG) =====
  // layout
  const grid = useMemo(() => {
    const width = VB_W;
    const height = VB_H;

    const top = SAFE_Y + height * 0.14;
    const bottom = height - SAFE_Y - height * 0.12;

    const LEFT = SAFE_X + Math.max(60, width * 0.20);
    const RIGHT = SAFE_X + 36;

    // spacing theo tỉ lệ (đơn giản)
    const fw = new Array(numFrets).fill(1);
    const total = fw.reduce((a, b) => a + b, 0);
    const fretXs = [LEFT];
    const gridWidth = width - LEFT - RIGHT;
    fw.forEach((w) => fretXs.push(fretXs[fretXs.length - 1] + gridWidth * (w / total)));

    const stringYs = new Array(numStrings).fill(0).map((_, i) =>
      top + ((bottom - top) * i) / (numStrings - 1)
    );

    return { LEFT, RIGHT, top, bottom, fretXs, stringYs };
  }, [numFrets, numStrings]);

  // hit testing
  function pickCell(clientX: number, clientY: number, svg: SVGSVGElement) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const { x, y } = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    // tìm dây gần nhất
    let sIdx = 0;
    let minDy = Infinity;
    grid.stringYs.forEach((yy, i) => {
      const d = Math.abs(yy - y);
      if (d < minDy) {
        minDy = d;
        sIdx = i;
      }
    });
    // tìm ngăn (1..numFrets), nếu trước vạch đầu coi như 0/open
    let f = 0;
    for (let i = 0; i < grid.fretXs.length - 1; i++) {
      const x1 = grid.fretXs[i], x2 = grid.fretXs[i + 1];
      if (x >= x1 && x <= x2) { f = i + 1; break; }
      if (x < grid.fretXs[0]) { f = 0; break; }
      if (x > grid.fretXs[grid.fretXs.length - 1]) { f = numFrets; break; }
    }
    return { stringIndex: sIdx, fret: f };
  }

  // mouse/drag để tạo barre: kéo trong cùng 1 cột fret
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ startS?: number; fret?: number } | null>(null);

  function onDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const { stringIndex, fret } = pickCell(e.clientX, e.clientY, svgRef.current);
    if (e.shiftKey) {
      // Shift = xoá barre ở ngăn này
      setBarres((prev) => prev.filter((b) => b.fret !== baseFret + fret - 1));
      return;
    }
    dragRef.current = { startS: stringIndex, fret };
  }

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !dragRef.current?.fret) return;
    // highlight tạm thời? (đơn giản: bỏ qua)
  }

  function onUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const info = dragRef.current;
    dragRef.current = null;
    if (!info || info.startS == null) return;
    const { stringIndex: endS, fret } = pickCell(e.clientX, e.clientY, svgRef.current);
    if (fret <= 0) return; // chỉ tạo barre trên fret > 0

    const from = Math.min(info.startS, endS) + 1; // 1..N
    const to = Math.max(info.startS, endS) + 1;
    const absFret = baseFret + fret - 1;

    // set barre (xóa trùng ngăn trước đó)
    setBarres((prev) => [
      ...prev.filter((b) => b.fret !== absFret),
      { fret: absFret, from, to, finger: 1 },
    ]);

    // đồng thời đặt tất cả dây trong khoảng from..to vào đúng ngăn nếu đang open
    setFrets((prev) => {
      const next = [...prev];
      for (let s = from; s <= to; s++) {
        const idx = s - 1;
        next[idx] = absFret; // đặt theo absFret
      }
      return next;
    });
  }

  // click đơn → set/clear/mute/open tuỳ modifier
  function onClickBoard(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const { stringIndex, fret } = pickCell(e.clientX, e.clientY, svgRef.current);

    setFrets((prev) => {
      const next = [...prev];
      if (e.altKey) {
        next[stringIndex] = -1; // mute
      } else if (e.metaKey || e.ctrlKey) {
        next[stringIndex] = 0; // open
      } else {
        // đặt theo absolute fret (baseFret + fret - 1), click lại cùng vị trí sẽ bỏ về 0
        const absFret = fret > 0 ? baseFret + fret - 1 : 0;
        next[stringIndex] = next[stringIndex] === absFret ? 0 : absFret;
      }
      return next;
    });
  }

  // keyboard: Esc đóng, ↑↓ chọn dây root, Del xoá barre đang ở ngăn base+fret?
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // dựng payload
  const shape: ChordShape = useMemo(() => {
    const used = frets.some((f) => f !== 0);
    const bf = Math.min(...frets.filter((f) => f > 0), baseFret) || baseFret;
    return {
      id: undefined,
      name: cleanSymbol(symbol),
      baseFret: bf,
      frets,
      fingers,
      rootString,
      barres: barres.length ? barres : undefined,
    };
  }, [frets, fingers, rootString, barres, baseFret, symbol]);

  const canSubmit =
    instrument !== "piano" && cleanSymbol(symbo
