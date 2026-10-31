import React from 'react';
import { EditorView } from './ReferenceViews.jsx';
import OfficePage from './OfficePage.jsx';

// The editor is the reference character surface. When the account is already
// set up, the office stays visible behind it, exactly as the earlier screens did.
export default function EditorRoute({ me, people, floor, version, onHost, office }) {
  return (
    <>
      {me.complete
        ? <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }} aria-hidden="true"><OfficePage {...office} /></div>
        : <main className="reference-character-page" />}
      <EditorView mode="editor" me={me} people={people} floor={floor} version={version} onHost={onHost} />
    </>
  );
}
