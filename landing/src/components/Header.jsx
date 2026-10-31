import { useState } from "react";
const navItems = [
  ["서비스 소개", "why"],
  ["주요 기능", "features"],
  ["도입 과정", "process"],
  ["도입 문의", "contact"],
];
export default function Header({ goTop, goLogin, goContact }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="s1 site-header">
      <div className="s2 header-inner">
        <button
          onClick={() => {
            setOpen(false);
            goTop();
          }}
          className="s3 brand-button"
        >
          <img
            src="assets/home/wordmark.png"
            alt="SENSPACE 홈"
            className="s4"
          />
        </button>
        <button
          className="mobile-menu"
          aria-controls="primary-navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "닫기" : "메뉴"}
        </button>
        <nav
          id="primary-navigation"
          aria-label="주요 메뉴"
          className={"s5 primary-navigation" + (open ? " is-open" : "")}
        >
          {navItems.map(([label, id]) => (
            <a
              key={id}
              className="s6"
              href={"#" + id}
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="s7 header-spacer" />
        <div className="s8 header-actions">
          <button onClick={goLogin} className="s9">
            로그인
          </button>
          <button onClick={goContact} className="s10">
            도입 문의
          </button>
        </div>
      </div>
    </header>
  );
}
