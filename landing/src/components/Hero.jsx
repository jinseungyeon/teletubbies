import React from "react";

export default function Hero({ goContact, goFeatures }) {
  return (
    <section className="s11 hero" id="top">
      <svg
        className="s12"
        width="44"
        height="44"
        viewBox="0 0 7 7"
        shapeRendering="crispEdges"
      >
        <path fill="#f5c542" d="M3 0h1v3h3v1H4v3H3V4H0V3h3z"></path>
      </svg>
      <svg
        className="s13"
        width="20"
        height="20"
        viewBox="0 0 7 7"
        shapeRendering="crispEdges"
      >
        <path fill="#f5c542" d="M3 0h1v3h3v1H4v3H3V4H0V3h3z"></path>
      </svg>
      <svg
        className="s14"
        width="46"
        height="46"
        viewBox="0 0 7 7"
        shapeRendering="crispEdges"
      >
        <path fill="#f5c542" d="M3 0h1v3h3v1H4v3H3V4H0V3h3z"></path>
      </svg>
      <svg
        className="s15"
        width="22"
        height="22"
        viewBox="0 0 7 7"
        shapeRendering="crispEdges"
      >
        <path fill="#f5c542" d="M3 0h1v3h3v1H4v3H3V4H0V3h3z"></path>
      </svg>
      <span className="s16">B2B 메타버스 오피스 · 감각 공유 서비스</span>
      <img src="assets/home/wordmark.png" alt="SENSPACE" className="s17" />
      <h1 className="hero-title">우리의 감각이 연결되는 사무실</h1>
      <p className="s19">
        실제 사무실 평면도 위에 동료들의 출근·자리 비움 상태와 소음·온도·냄새
        같은 감각을 함께 보여줘요. 말하지 않아도 서로를 배려하는 사무실을
        Senspace로 만들어 보세요.
      </p>
      <div className="s20">
        <button onClick={goContact} className="s21">
          도입 문의하기
        </button>
        <button onClick={goFeatures} className="s22">
          기능 살펴보기
        </button>
      </div>
    </section>
  );
}
