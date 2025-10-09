// src/components/chord/DeleteVoicingScopeDialog.tsx
import { useState } from "react";
import type { ChordEntry } from "../../types/chord";
import "../../styles/DeleteVoicingScopeDialog.scss"; // <-- thêm style riêng cho modal

type Scope = "single" | "shape+fingers";

export default function DeleteVoicingScopeDialog(props: {
  isOpen: boolean;
  chord: ChordEntry | null;
  variantIndex: number | null;
  isAdmin?: boolean;
  onClose: () => void;
  onConfirm: (scope: Scope) => void;
}) {
  const { isOpen, chord, variantIndex, isAdmin, onClose, onConfirm } = props;
  const [scope, setScope] = useState<Scope>("single");

  if (!isOpen || !chord || variantIndex == null) return null;

  const vIdxHuman = variantIndex + 1;
  const title = `Xoá voicing #${vIdxHuman} - ${chord.symbol} (${chord.instrument})`;

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="del-scope-title">
      <div className="dialog-surface">
        <div className="dialog-header">
          <h3 id="del-scope-title">{title}</h3>
        </div>

        <div className="dialog-body" style={{ display: "grid", gap: 12 }}>
          <p>Chọn phạm vi xoá:</p>

          <label className="radio-row">
            <input
              type="radio"
              name="del-scope"
              value="single"
              checked={scope === "single"}
              onChange={() => setScope("single")}
            />
            <span>Chỉ xoá voicing này</span>
          </label>

          <label className="radio-row">
            <input
              type="radio"
              name="del-scope"
              value="shape+fingers"
              checked={scope === "shape+fingers"}
              onChange={() => setScope("shape+fingers")}
            />
            <span>
              Xoá tất cả voicing giống nhau <b>(cùng form + cùng sắp xếp ngón)</b>
            </span>
          </label>

          <div className="hint">
            Gợi ý: tuỳ chọn thứ 2 sẽ xoá cả các bản được autogen từ cùng một thế tay nhưng đã transpose,
            miễn là pattern ngón hoàn toàn trùng khớp.
          </div>

          {!isAdmin && (
            <div className="warn">
              * Bạn không phải admin: bạn chỉ có thể xoá ở <b>kho riêng</b> của mình.
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn" onClick={onClose}>Huỷ</button>
          <button className="btn-primary" onClick={() => onConfirm(scope)}>Xác nhận xoá</button>
        </div>
      </div>
    </div>
  );
}
