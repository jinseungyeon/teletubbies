import './sprites.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createAdapter } from './data.js';
import { SESSION } from './session.js';

// The temporal office map is written as a DCLogic subclass and is executed
// directly by the Node tests, so it expects these globals instead of imports.
// Set them before the module below is evaluated.
globalThis.React = React;
globalThis.DCLogic = React.Component;
window.SenspaceSession = SESSION;
SESSION.mode = 'inline';

const api = createAdapter(window.localStorage);

async function boot() {
  await import('./senspace.js');
  const { default: App } = await import('./react/App.jsx');
  createRoot(document.getElementById('root')).render(<App api={api} />);
}

boot();
