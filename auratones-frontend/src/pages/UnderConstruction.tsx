// src/pages/UnderConstruction.tsx
import React from "react";
import { Link } from "react-router-dom";
import "../styles/UnderConstruction.scss";

export default function UnderConstruction() {
  return (
    <main className="uc-wrap" aria-labelledby="ucTitle">
      <div className="uc-anim" aria-hidden>
        <div className="uc-crane">
          <div className="uc-rope" />
          <div className="uc-hook" />
        </div>
        <div className="uc-bar">
          <div className="uc-fill" />
        </div>
      </div>

      <h1 id="ucTitle" className="uc-title">Nội dung đang được hoàn thiện</h1>
      <p className="uc-sub">Bạn quay lại sau nhé.</p>

      <Link to="/" className="btn-home" aria-label="Về trang chủ">Về trang chủ</Link>
    </main>
  );
}
