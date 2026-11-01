import React from "react";

export default function Footer({ goContact, goLogin }) {
  return (
    <footer className="s153">
      <div className="s154">
        <svg
          className="s155"
          width="40"
          height="40"
          viewBox="0 0 7 7"
          shapeRendering="crispEdges"
        >
          <path fill="#f5c542" d="M3 0h1v3h3v1H4v3H3V4H0V3h3z"></path>
        </svg>
        <svg
          className="s156"
          width="24"
          height="24"
          viewBox="0 0 7 7"
          shapeRendering="crispEdges"
        >
          <path fill="#f5c542" d="M3 0h1v3h3v1H4v3H3V4H0V3h3z"></path>
        </svg>
        <img
          src="/assets/home/wordmark-white.png"
          alt="SENSPACE"
          className="s157"
        />
        <div className="s158">우리의 감각이 연결되는 사무실</div>
        <div className="s159">
          <button onClick={goContact} className="s160">
            도입 문의하기
          </button>
          <button onClick={goLogin} className="s161">
            조직 로그인
          </button>
        </div>
        <div className="s162">© 2026 Senspace · contact@senspace.io</div>
      </div>
      <img src="/assets/home/office-night.png" alt="" className="s163" />
    </footer>
  );
}
