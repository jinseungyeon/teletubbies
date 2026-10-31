# Senspace landing verification

Date: 2026-11-01

final result: passed

## Reference and visual comparison

Opened the supplied `Senspace B2B.dc.html` via a local HTTP server and inspected screenshots of the hero and features at 1280 × 720. Inspected corresponding production-preview screenshots. The original wordmarks, day/night office banners, floor plan, icons, character configurations, palette, spacing and public section order are retained. Section anchors intentionally leave space beneath the sticky header.

At 320, 390, 768, 1024 and 1440 CSS pixels, the document width equals the viewport width. Mobile navigation collapses into an accessible menu, feature columns stack, feature descriptions precede previews, and form fields stack. Screenshots inspected at 390 for hero, feature cards and inquiry states, at 320 for narrow layout, and at 1440 for desktop hero. No missing images: all 42 images load in the production preview.

## Behavior

- Navigation anchors, mobile menu open/close and CTA scrolling verified in browser.
- Direct `#features` URL reload lands at the feature section with 96px header clearance.
- One h1; labeled native form controls; native modal dialog focus and return verified.
- Inquiry rejects whitespace-only company/name. A valid inquiry generates an encoded mail draft preserving Korean, ampersands and multiline content. No email was sent.
- No claim of acceptance is made in email-draft mode. Actual API submission and separately deployed login require deployment URLs and have not been tested against live services.
- Fresh production-preview browser tab reports no console warnings or errors. A temporary development-client error during the Vite upgrade was resolved by restarting on the final production build.

## Automated checks

- `npm test`: 3 passed, 0 failed (required values, attachment bounds, encoded email draft).
- `npm run build`: successful with Vite 8.3.5 and React 18.3.1.
- Package installation audit after toolchain update: 0 vulnerabilities.
- Changed tracked paths are confined to `landing/`; existing `be` and `fe` sources remain unchanged.

## Deployment notes

Deploy with root directory `landing`, build `npm run build`, publish `dist`. Set `VITE_APP_URL` and optional `VITE_CONTACT_ENDPOINT` before building. The endpoint must accept multipart POST and allow the landing origin. Default inquiry behavior is explicitly an email draft.
