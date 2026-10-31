import { useRef } from 'react';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import Contact from './components/Contact.jsx';
import Process from './components/Process.jsx';
import Features from './components/Features.jsx';
import Why from './components/Why.jsx';
import OfficeBanner from './components/OfficeBanner.jsx';
import './reference.css';
const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
export default function App() {
  const loginDialog = useRef(null);
  const goContact = () => scrollTo('contact');
  const goLogin = () => {
    const appUrl = import.meta.env.VITE_APP_URL;
    if (appUrl && /^https?:\/\//.test(appUrl)) window.location.assign(appUrl);
    else loginDialog.current.showModal();
  };
  return <>
    <a className="skip-link" href="#main">본문으로 건너뛰기</a>
    <Header goTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })} goContact={goContact} goLogin={goLogin} />
    <main id="main">
      <Hero goContact={goContact} goFeatures={() => scrollTo('features')} />
      <OfficeBanner />
      <Why />
      <Features />
      <Process />
      <Contact />
    </main>
    <dialog ref={loginDialog} className="login-dialog" aria-labelledby="login-title">
      <h2 id="login-title">조직 로그인 안내</h2>
      <p>조직에서 안내받은 Senspace 주소로 로그인해 주세요.<br />로그인 주소는 도입 담당자에게 문의하실 수 있어요.</p>
      <a href="mailto:contact@senspace.io">contact@senspace.io</a>
      <form method="dialog"><button className="primary-button">확인</button></form>
    </dialog>
  </>;
}
