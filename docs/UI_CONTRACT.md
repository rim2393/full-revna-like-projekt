# Lumen Admin UI Contract

## Scope

The current web scaffold lives in `apps/web` and covers the Lumen Guard admin entry plus the first admin shell. It intentionally contains placeholder data only; no backend, node, installer, license-service, secrets, tokens, generated runtime configs, or subscription URLs are stored in the UI.

## Routes

- `/guard/login` - Lumen Guard login form.
- `/guard/mfa` - MFA challenge form.
- `/guard/portal` - guarded handoff into the admin control plane.
- `/dashboard` - overview shell with TanStack Query placeholder data.
- `/users`, `/nodes`, `/hosts`, `/profiles`, `/squads`, `/subscription`, `/license`, `/api-keys` - placeholder resource workspaces.

## Structure

- `src/app` owns providers, query client setup, and route definitions.
- `src/features/auth` owns Guard login/MFA/portal screens.
- `src/pages` owns dashboard and resource placeholder screens.
- `src/shared/components` owns shell, navigation, metrics, badges, headers, and brand primitives.
- `src/shared/data` owns mock UI data and navigation maps.
- `src/shared/styles` owns CSS design tokens and global layout rules.
- `src/test` owns testing setup and router render helpers.

## Design Tokens

The Lumen look uses graphite surfaces, green safety accents, amber warning states, compact 4/8 spacing, and card radii at 8px or below. Density is encoded with `data-density="compact"` selectors so the core UI does not depend on container style queries. Dashboard containment uses `content-visibility: auto` with a `contain` fallback.

## Integration TODO

- Replace placeholder query functions with generated API clients once contracts are stable.
- Add auth/session guards around protected admin routes.
- Add table state, pagination, filtering, optimistic mutations, and audit-safe notifications.
- Add visual regression coverage after real data components land.
