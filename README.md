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

## Deployment

Netlify runs `npm run build`, publishes `dist`, and rewrites application routes to `index.html` so refreshed guide URLs continue to work.

Secure `{{ENVIRONMENT_VARIABLE}}` placeholders in Sheet display text are resolved inside the guide-content function after authentication. Missing placeholder values are treated as configuration errors and are never returned to the browser.
