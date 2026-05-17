# Finanzar - Project Instructions

## Product Direction

Finanzar is a finance management app for individuals, couples, households, freelancers, and small businesses.

The app must be built mobile first and prepared as an installable PWA. Offline support should start with read-only offline access. Offline writes and sync conflict handling are future scope.

Use `ROADMAP.md` as the product planning reference. Keep it updated when major features are started, completed, postponed, or re-scoped.

## Design System

Always respect the existing color palette and CSS variables defined in `app/globals.css`.

Always respect the fonts configured in `app/layout.tsx`.

Do not introduce a new visual theme unless explicitly requested.

The UI should feel like a practical finance app: clear, calm, dense enough for repeated use, and optimized for mobile.

Always prioritize UX/UI clarity. The product should be usable and understandable by people of any age and any level of financial or technical experience.

Use plain, familiar language in Spanish for user-facing text. Avoid ambiguous labels when a term can mean more than one thing. For example, prefer "cuenta financiera", "cuenta bancaria", "billetera" or "caja" instead of only "cuenta" when it could be confused with a user account.

Design flows so the next action is obvious. Prefer guided empty states, helpful labels, short explanations, and visible feedback over assuming the user already understands the financial model.

Keep forms simple and forgiving: use clear field names, examples/placeholders, sensible defaults, validation messages in everyday language, and avoid asking for information before it is actually needed.

## Icons

Use `lucide-react` for icons when needed.

Prefer recognizable icons for actions such as add, edit, delete, filter, search, calendar, wallet, card, chart, settings, user, lock, bell, etc.

## Frontend Rules

Build mobile first.

Avoid landing-page style screens unless explicitly requested.

Prioritize real app screens and workflows.

Use responsive layouts that work well on small phones first, then scale up to desktop.

## Data And Architecture

Use Next.js full-stack, Prisma, and PostgreSQL.

The data model is workspace-based. Financial data belongs to a `Workspace`, not directly to a single user.

Do not expose Prisma Client to client components.

## Folder Structure

Follow this structure when adding new code:

```txt
app/
  (marketing)/
    page.tsx
  (auth)/
    sign-in/
      page.tsx
    sign-up/
      page.tsx
  (app)/
    layout.tsx
    dashboard/
      page.tsx
    accounts/
      page.tsx
    transactions/
      page.tsx
    cards/
      page.tsx
    projects/
      page.tsx
    settings/
      page.tsx
  api/
    auth/
      [...nextauth]/
        route.ts
  globals.css
  layout.tsx

components/
  ui/
  layout/
  forms/
  feedback/

features/
  auth/
    actions.ts
    queries.ts
    schemas.ts
    components/
  workspaces/
    actions.ts
    queries.ts
    schemas.ts
    components/
  accounts/
    actions.ts
    queries.ts
    schemas.ts
    components/
  transactions/
    actions.ts
    queries.ts
    schemas.ts
    components/
  cards/
    actions.ts
    queries.ts
    schemas.ts
    components/
  projects/
    actions.ts
    queries.ts
    schemas.ts
    components/
  recurring/
    actions.ts
    queries.ts
    schemas.ts
    components/
  budgets/
    actions.ts
    queries.ts
    schemas.ts
    components/

lib/
  auth/
  db/
  pwa/
  utils/
  validations/
  prisma.ts

prisma/
  migrations/
  schema.prisma

public/
  icons/
  images/

types/
```

### Structure Rules

Use `app/` mostly for routing, layouts, loading states, error boundaries, and composing feature screens.

Put domain logic in `features/<domain>/`. Each domain can own its server actions, read queries, validation schemas, and domain-specific components.

Put reusable, domain-agnostic UI in `components/ui/`. Put app shell components such as bottom navigation, sidebars, headers, and mobile navigation in `components/layout/`.

Put shared infrastructure in `lib/`: auth configuration, Prisma access, PWA helpers, formatting utilities, permissions, and reusable validation helpers.

Server-only database access must go through server files, server actions, route handlers, or query helpers. Never import Prisma Client into client components.

Prefer small, focused files. Avoid large catch-all utility files. If a helper belongs to one domain, keep it inside that domain under `features/`.

Use route groups such as `(auth)`, `(app)`, and `(marketing)` to keep URL structure clean while organizing layouts.

Keep Prisma migrations committed. Keep generated Prisma client files ignored.
