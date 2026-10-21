# Hytteguiden

Hytteguiden is a mobile-first web application that provides simple, step-by-step cabin procedures. Guides are defined as directed graphs, while editable content for mapped pages is loaded from a public Google Sheet through an authenticated Netlify Function. Answers and instruction progress are stored locally and used to derive the active path.

## Technology

- React and TypeScript
- Vite
- React Router
- Netlify

## Local development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Project structure

- `src/pages/GuidePage.tsx` renders guide nodes and the active-path overview.
- `src/components` contains shared interface components.
- `src/guideData.ts` contains typed guide definitions and graph connections.
- `shared/guideContent.ts` defines the allowlisted Sheet page IDs and normalized response contract.
- `netlify/functions/guide-content.mts` fetches, validates, and normalizes published Sheet rows for authenticated visitors.
- `src/guideEngine.ts` derives active paths, statuses, and logical navigation.
- `src/guideRequirements.ts` evaluates Sheet-defined answer requirements without changing route IDs.
- `src/guideStorage.ts` persists only question answers and instruction progress.
- `src/auth.tsx` restores and exposes the signed family-member session.
- `netlify/functions` validates family accounts and manages the signed HttpOnly session cookie.
- `netlify.toml` defines the production build and SPA route fallback.

## Family event responses

Families can respond to another family's event from its details page at `/booking/event/:eventId`.
The dedicated `/booking/event/:eventId/svar` page starts with no attendees selected, supports
registered family members and multiple named guests, and allows an explicit nobody-attending response.
Saved responses load when editing. The event owner cannot submit a response to their own event.
Cabin bookings do not use this feature.

The `family-event-rsvp` Netlify Function uses the existing authenticated session cookie and derives
the responding family from that session, never from client-provided ownership fields. Responses are
stored in Netlify Database with a unique event/family key, member IDs, nonempty guest names, and
creation/update timestamps. Updating a response preserves its original creation timestamp.
The new table is defined in `db/schema.ts` and its migration is applied automatically on deployment.

## Deployment

Netlify runs `npm run build`, publishes `dist`, and rewrites application routes to `index.html` so refreshed guide URLs continue to work.

Secure `{{ENVIRONMENT_VARIABLE}}` placeholders in Sheet display text are resolved inside the guide-content function after authentication. Missing placeholder values are treated as configuration errors and are never returned to the browser.

## Progressive web app

Hytteappen can be installed from its HTTPS site: use Chrome's **Installer app** option on Android, or Safari's **Del → Legg til på Hjem-skjerm** on iPhone. Launching the installed icon opens the app in standalone mode. Authentication and online features work as before; installation does not grant access or make personal data available offline.

The small build-only plugin in `pwa/plugin.ts` generates `/sw.js` from the production asset list. Only static HTML, bundled JavaScript/CSS/fonts, the manifest and installation icons are precached. The icons reuse the existing cabin mark, with opaque backgrounds and maskable safe margins. API responses, Google Sheets responses, sessions, profile images and all other runtime data bypass the worker. Existing application storage is unchanged. No offline guide downloads or push notifications are implemented; future features can extend the single worker separately without widening the shell cache policy.

New deployments are checked on startup, when returning to the app, after reconnecting and hourly while visible. An installed update waits until the user selects **Oppdater nå**; **Senere** keeps the current page open. Save unfinished work before accepting an update. The initial installation does not prompt or reload.

After Netlify's production build/deploy, verify in Chrome DevTools **Application** that the manifest has no installability errors, the worker is active, and Cache Storage contains only the shell allowlist. Test installation on Android and iPhone and open a direct guide URL. Visit calendar/profile pages and confirm no API responses or uploaded images enter Cache Storage. Deploy a second version, return to the existing app, check **Senere**, then reopen and choose **Oppdater nå** to verify the new version loads without losing the signed-in session. Production workers are deliberately disabled in Vite development mode.
