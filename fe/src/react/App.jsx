import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SESSION } from '../session.js';
import EntryPage from './EntryPage.jsx';
import OfficePage from './OfficePage.jsx';
import ProfilePage from './ProfilePage.jsx';
import EditorRoute from './EditorRoute.jsx';

const clone = value => JSON.parse(JSON.stringify(value));

// Each person's private link is /enter/<token> (a ?t= query is accepted too).
function readEntryToken() {
  const match = location.pathname.match(/^\/enter\/([^/]+)\/?$/);
  if (match) return decodeURIComponent(match[1]);
  return new URLSearchParams(location.search).get('t') || '';
}

export default function App({ api }) {
  const [me, setMe] = useState(null);
  const [people, setPeople] = useState([]);
  const [version, setVersion] = useState(0);
  const [route, setRoute] = useState(location.pathname);
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState('');
  const [entryError, setEntryError] = useState('');
  const [message, setMessage] = useState('');
  const [profileStash, setProfileStash] = useState(null);
  const toastTimer = useRef();

  const toast = useCallback(text => {
    setMessage(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(''), 3200);
  }, []);

  const sync = useCallback(async () => {
    const [current, list] = await Promise.all([api.me(), api.list()]);
    SESSION.current = current;
    SESSION.users = list;
    setMe(current);
    setPeople(list);
    setVersion(v => v + 1);
    return { m: current, list };
  }, [api]);

  const refresh = useCallback(async () => {
    const { m } = await sync();
    return m;
  }, [sync]);

  const applyRoute = useCallback(current => {
    let next = location.pathname;
    if (!current) {
      // Keep a failed /enter/<token> URL so reloading retries the same link.
      if (next !== '/' && !next.startsWith('/enter')) history.replaceState({}, '', '/');
      next = '/';
    } else if (!current.complete) {
      if (next !== '/office') history.replaceState({}, '', '/office');
      next = '/office';
    } else if (next === '/' || next === '/login' || next === '/signup' || next.startsWith('/enter')) {
      history.replaceState({}, '', '/office');
      next = '/office';
    }
    window.scrollTo(0, 0);
    setRoute(next);
  }, []);

  const navigate = useCallback(async url => {
    if (url !== location.pathname) history.pushState({}, '', url);
    try {
      const { m } = await sync();
      applyRoute(m);
    } catch (error) {
      toast(error.message);
    }
  }, [sync, applyRoute, toast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let enterError = '';
        const token = readEntryToken();
        try {
          if (token) {
            await api.enter(token);
            history.replaceState({}, '', '/office');
          } else if (location.pathname === '/demo') {
            await SESSION.api.enter('demo-entry');
            history.replaceState({}, '', '/office');
          }
        } catch (error) {
          enterError = error.message;
        }
        if (!alive) return;
        if (enterError) setEntryError(enterError);
        const { m } = await sync();
        if (alive) applyRoute(m);
      } catch (error) {
        if (alive) setFatal(error.message);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; clearTimeout(toastTimer.current); };
  }, [api, sync, applyRoute]);

  const enterDemo = useCallback(async () => {
    try {
      setEntryError('');
      await SESSION.api.enter('demo-entry');
      history.replaceState({}, '', '/office');
      const { m } = await sync();
      applyRoute(m);
    } catch (error) {
      setEntryError(error.message);
    }
  }, [sync, applyRoute]);

  const enterLink = useCallback(async token => {
    try {
      setEntryError('');
      await api.enter(token);
      history.replaceState({}, '', '/office');
      const { m } = await sync();
      applyRoute(m);
    } catch (error) {
      setEntryError(error.message);
    }
  }, [api, sync, applyRoute]);

  const logout = useCallback(async () => {
    try {
      await SESSION.api.logout();
      SESSION.current = null;
      setMe(null);
      await navigate('/');
    } catch (error) {
      toast(error.message);
    }
  }, [navigate, toast]);

  const editCharacter = useCallback(draft => {
    setProfileStash(clone(draft));
    navigate('/character');
  }, [navigate]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden || !document.querySelector('.hub')) return;
      try {
        const { m } = await sync();
        if (!m) await navigate('/');
      } catch (error) {
        toast(error.message);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [sync, navigate, toast]);

  useEffect(() => {
    const onStorage = async () => {
      try {
        const { m } = await sync();
        if (!m) await navigate('/');
      } catch (error) {
        toast(error.message);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [sync, navigate, toast]);

  useEffect(() => {
    const onPop = async () => {
      try {
        const { m } = await sync();
        applyRoute(m);
      } catch (error) {
        toast(error.message);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [sync, applyRoute, toast]);

  const onEditorHost = useCallback(async (type) => {
    if (type === 'saved') {
      const current = await refresh();
      const target = current?.complete ? (profileStash ? '/profile' : '/office') : '/office';
      await navigate(target);
      toast('캐릭터를 저장했어요.');
    } else if (type === 'close') {
      await navigate(me?.complete ? (profileStash ? '/profile' : '/office') : '/office');
    }
  }, [refresh, navigate, profileStash, me, toast]);

  const officeProps = { api, me, people, version, refresh, toast, navigate, onLogout: logout };

  let content = null;
  if (fatal) {
    content = (
      <main className="fatal">
        <h1>화면을 불러오지 못했어요</h1>
        <p>{fatal}</p>
        <button className="primary" onClick={() => window.location.reload()}>다시 시도</button>
      </main>
    );
  } else if (ready) {
    if (!me) {
      content = <EntryPage error={entryError} onEnter={enterLink} onDemo={enterDemo} />;
    } else if (route === '/character') {
      content = (
        <EditorRoute
          me={me}
          people={people}
          floor={me.floor}
          version={version}
          onHost={onEditorHost}
          office={officeProps}
        />
      );
    } else if (route === '/profile') {
      content = (
        <ProfilePage
          api={api}
          me={me}
          people={people}
          onboarding={false}
          profileStash={profileStash}
          onConsumeStash={() => setProfileStash(null)}
          navigate={navigate}
          toast={toast}
          onLogout={logout}
          onEditCharacter={editCharacter}
        />
      );
    } else {
      content = <OfficePage {...officeProps} />;
    }
  }

  return (
    <>
      {content}
      <div id="toast" className={message ? 'visible' : ''}>{message}</div>
    </>
  );
}
