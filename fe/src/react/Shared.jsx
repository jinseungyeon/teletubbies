import React from 'react';
import { icon, faceAvatar as faceAvatarHTML, look } from './helpers.js';

// Host markup was authored as HTML strings for pixel icons and character art.
// These tiny wrappers keep that markup without re-drawing it, while the rest of
// the screen is ordinary React.
export function Raw({ html }) {
  return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />;
}
export function Icon({ name, size = 20 }) {
  return <Raw html={icon(name, size)} />;
}
export function FaceAvatar({ user, size }) {
  return <Raw html={faceAvatarHTML(look(user), size)} />;
}
export function Brand({ onNavigate }) {
  return (
    <a href="/office" className="brand" onClick={e => { e.preventDefault(); onNavigate('/office'); }}>
      <span className="brand-mark"><Icon name="spark" size={24} /></span>
      <span>Sensory<span className="brand-light"> Fit</span><small>OUR LITTLE OFFICE</small></span>
    </a>
  );
}
