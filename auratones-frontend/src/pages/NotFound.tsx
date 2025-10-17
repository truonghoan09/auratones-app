// src/pages/NotFound.tsx
import React from "react";
import { Link } from "react-router-dom";
import "../styles/NotFound.scss";

export default function NotFound() {
  return (
    <main className="nf-wrap" aria-labelledby="nfTitle">
      {/* Nền hiệu ứng + 404 ở background */}
      <div className="nf-stage" aria-hidden>
        <span className="nf-digit d4">4</span>
        <span className="nf-digit d0">0</span>
        <span className="nf-digit d4b">4</span>

        <div className="nf-spark s1" />
        <div className="nf-spark s2" />
        <div className="nf-spark s3" />
        <div className="nf-orbit o1" />
        <div className="nf-orbit o2" />
      </div>

      {/* Nội dung nằm trên, không bị đè */}
      <div className="nf-content">
        <h1 id="nfTitle" className="nf-title">Trang này không tồn tại</h1>
        <p className="nf-sub">Có thể bạn nhập sai đường dẫn hoặc trang đã được chuyển đi.</p>
        <Link to="/" className="btn-home" aria-label="Về trang chủ">Về trang chủ</Link>
      </div>
    </main>
  );
}
