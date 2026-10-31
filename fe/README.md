# Sensory Fit

`npm run dev` serves the app at http://localhost:5173. It is a single Vite + React 18 application: one React tree, client-side routes (`/login`, `/signup`, `/office`, `/profile`, `/character`, `/onboarding`) and shared state. There are no iframes and no `postMessage` bridge.

The reference-derived surfaces (office map, team-area selection, seat picker, character editor, notification settings) live in `src/senspace.js` as a `DCLogic` subclass. `src/react/ReferenceViews.jsx` subclasses it and renders its `renderVals()` output as ordinary React; the host passes `me`, `people`, `floor` and a data `version` as props and receives host events (`card`, `expand`, `saved`, `close`) through `onHost`.

- `index.html` / `src/main.jsx`: Vite entry. Puts `React`, `DCLogic` and `window.SenspaceSession` in place, then boots the React app.
- `src/react/App.jsx`: account/session state, routing, polling, logout and demo entry.
- `src/react/OfficePage.jsx`, `ProfilePage.jsx`, `AuthPage.jsx`, `SenseCard.jsx`: office hub, profile/onboarding, login/signup and sensory card.
- `src/senspace.js`: map camera, team rectangle, seats, profile cards, character editing and notification preferences. It is also executed directly by the Node tests, so it must not gain `import`/`export`.
- `src/data.js`, `src/session.js`, `src/reference-model.js`: local account adapter, session snapshot and the model the map consumes.
- `src/sprites.js`, `src/assets/`: pixel character generator, tiles, furniture and icons. Everything is local; the app does not depend on the original reference folder or any CDN.

This is a frontend local demo: accounts are browser-local, passwords are neither saved nor authenticated, and the media in `src/assets/` was copied from the supplied reference. Team bounds, notification preferences and each account's profile persist in local storage. Browser notifications need user-granted permission; live events from other users require a backend connection.

`npm run check` runs syntax checks and a production build. `npm test` covers reference seat layout, popover/card navigation, team drag bounds/persistence, character persistence, onboarding, notification preferences and icon assets. Tests use isolated in-memory storage and never change a real user's profile.
