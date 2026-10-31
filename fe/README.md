# Senspace v2

`npm run dev` serves the existing app at http://localhost:5173, using `src/app.js` and `src/styles.css`.
The full reference replacement was disconnected because it also changed UI outside the requested scope. Existing bottom cards, sensory controls, colleague list and previous spacing adjustments remain active.

The new reference implementation is retained as an isolated, unfinished integration preview. `npm run build` generates `senspace-preview.html`, available at http://localhost:5173/senspace-preview.html. It never overwrites `index.html`. Requested features still need selective integration into the existing app; this preview is not the default app.

- `src/senspace.template.html`: reference-derived office, onboarding, character editor, sensory card and settings markup.
- `src/senspace-auth.html`: login/signup using the same visual language (the supplied reference starts with an invitation, not credential forms).
- `src/senspace.js`: application state, map camera, team selection, seats, profile cards, character editing and notification preferences.
- `src/senspace-bootstrap.js`: existing local account adapter and character migration.
- `src/senspace.css`: local fonts and shared layout refinements.
- `vendor/`: React 18.3.1 UMD files and the supplied reference's DC renderer. Normal startup does not require a CDN.
- `src/sprites.js`, `src/assets/`: pixel character generator, tiles, furniture and icons copied from the supplied reference. The app no longer depends on the original reference folder.

This remains a frontend local demo: accounts are browser-local, passwords are neither saved nor authenticated, and photo conversion samples colors locally rather than calling an AI service. Team bounds, notification preferences and each account's v2 profile persist in local storage. Browser notifications need user-granted permission; live events from other users require a backend connection. Selecting notification recipients records a preference; the local demo has no incoming multi-user event stream.

`npm run check` checks JavaScript syntax. `npm test` covers reference seat layout, popover/card navigation, team drag bounds/persistence, character persistence, onboarding, notification preferences and existing modules. Tests use isolated in-memory storage and never change a real user's profile.
