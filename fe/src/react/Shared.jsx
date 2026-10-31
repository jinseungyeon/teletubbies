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
// Brand mark: a chunky pixel S drawn as rects so it stays crisp at any size.
export function PixelS({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      <g fill="currentColor">
        <rect x="5" y="1" width="6" height="2" />
        <rect x="3" y="3" width="2" height="2" />
        <rect x="3" y="5" width="2" height="2" />
        <rect x="5" y="7" width="6" height="2" />
        <rect x="11" y="9" width="2" height="2" />
        <rect x="11" y="11" width="2" height="2" />
        <rect x="5" y="13" width="6" height="2" />
      </g>
    </svg>
  );
}
export function Brand({ onNavigate }) {
  return (
    <a href="/office" className="brand" onClick={e => { e.preventDefault(); onNavigate('/office'); }} aria-label="SENSPACE">
      <span className="brand-mark"><span className="brand-s">S</span><span className="brand-star">✦</span></span>
      <span className="brand-word">SENSPACE</span>
    </a>
  );
}
