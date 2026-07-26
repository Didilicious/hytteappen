# Hytteguiden Agent Guide

## Architecture

Hytteguiden is a client-side React application built with TypeScript and Vite. React Router owns navigation, including protected routes and parameterized guide URLs. Authentication is intentionally lightweight: a shared password sets a Local Storage flag, and protected routes redirect unauthenticated visitors to `/login`.

The guide is data-driven. `src/guideData.ts` defines the discriminated union for question, instruction, and completion nodes as well as all current guide content. `src/pages/GuidePage.tsx` is the single renderer for every guide node. Add guide steps to the data file instead of creating route components for individual steps.

## Key directories

- `src/components`: Shared visual components and layout.
- `src/pages`: Route-level screens.
- `src/guideData.ts`: Typed guide nodes and navigation relationships.
- `src/auth.ts`: Shared-password authentication helpers.
- `src/styles.css`: Global design system and responsive styles.

## Conventions

- Keep developer-facing code, filenames, identifiers, and comments in English.
- Keep all user-facing application copy in Norwegian.
- Preserve semantic HTML, visible focus states, large touch targets, and disabled button semantics.
- Use the existing CSS custom properties when extending the interface.
- Keep guide IDs unique and use configured next-node IDs for navigation.
- Do not create one React page per guide node.

## Deployment decisions

Netlify builds with `npm run build` and publishes `dist`. The catch-all rewrite in `netlify.toml` is required because this application uses browser history routes and guide URLs must remain refreshable.
