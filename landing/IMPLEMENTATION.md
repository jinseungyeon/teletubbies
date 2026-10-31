# Senspace B2B landing implementation

Reference: supplied `Senspace B2B.dc.html` and its assets. Implement the public homepage in React with the same copy, palette, pixel imagery and section order. Preserve `be` and `fe`; deploy `landing` as its own Vite application.

Commit sequence: independent foundation; header and hero; service introduction; four feature rows; introduction process; inquiry form; footer; responsive and browser verification. Each section has its own commit so it can be reverted independently.

Navigation scrolls to section anchors. Login opens the separately deployed application, configured by `VITE_APP_URL`. Inquiry posts multipart data only when `VITE_CONTACT_ENDPOINT` is configured; otherwise it opens a clearly identified email draft rather than claiming a server accepted a request. No authentication or office application is duplicated here.

Verification: production build per section, form behavior checks, desktop/mobile browser inspection and final comparison with the supplied HTML. No deployment or push to main.
