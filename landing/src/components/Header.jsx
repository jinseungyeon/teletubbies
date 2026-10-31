import React from 'react';
const navItems = [['서비스 소개','why'],['주요 기능','features'],['도입 과정','process'],['도입 문의','contact']].map(([label,id]) => ({label,onClick:()=>document.getElementById(id)?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'})}));
export default function Header({ goTop, goLogin, goContact }) {
return (<header className="s1">
    <div className="s2">
      <button onClick={goTop} className="s3"><img src="assets/home/wordmark.png" alt="SENSPACE" className="s4" /></button>
      <nav className="s5">{navItems.map((n, index) => <React.Fragment key={n.label ?? index}><button onClick={n.onClick} className="s6">{n.label}</button></React.Fragment>)}</nav>
      <div className="s7"></div>
      <div className="s8">
        <button onClick={goLogin} className="s9">로그인</button>
        <button onClick={goContact} className="s10">도입 문의</button>
      </div>
    </div>
  </header>);
}
