# AGENTS.md

This repository uses Tailwind CSS and a shared design system. When generating or editing UI, prioritize consistency over novelty.

## Non-negotiables (UI)
- Use Tailwind utility classes only. Do not add inline styles.
- Do not use Tailwind arbitrary values (e.g. `p-[13px]`, `w-[372px]`, `text-[#123456]`) unless the repo already uses them in the same area and there is no alternative.
- Use theme tokens / semantic classes (e.g. `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`, `bg-primary`, `text-primary-foreground`) instead of hard-coded colours.
- Mobile-first: base classes target mobile, then add `sm:`, `md:`, `lg:`, `xl:` only as needed.
- Reuse existing components from the UI library before creating new UI patterns.

## Layout conventions
- Prefer a consistent page wrapper: `mx-auto w-full max-w-6xl px-4 sm:px-6` (or match the closest existing page wrapper in the repo).
- Use consistent spacing scale: prefer `gap-2/3/4/6/8`, `p-3/4/6`, `py-4/6`, `mt-4/6/8`.
- Prefer consistent radii/shadows: `rounded-xl`/`rounded-2xl`, `shadow-sm` only when needed.
- Prefer `min-h` and flexible layouts instead of fixed heights/widths.

## Components
- Prefer the existing component library (buttons, inputs, dialogs/drawers, cards, tables, tabs).
- If a new component is required, make it composable and align naming/style with existing components.
- Match existing patterns for: empty states, loading states, error states, and toasts.

## Accessibility
- All interactive elements must be keyboard reachable.
- Use proper semantic elements and labels for form inputs.
- Ensure visible focus (`focus-visible:*` patterns used in the repo).
- Colour contrast must remain readable in light and dark themes.

## Behaviour and state
- Keep state management consistent with existing patterns in the repo.
- Avoid introducing new libraries for simple UI state.

## Validation before finishing
- Run lint/typecheck/tests if available.
- Ensure no arbitrary Tailwind values or hard-coded colours were introduced.
- Compare the new screen with the closest existing screens and align spacing, typography, and component usage.

## State Management
- Use MobX for global state (e.g., `stores/travelStore.ts`)
- Mutations must go through MobX actions (never mutate state directly)
- Use React hooks for local component state
- Follow existing patterns in the repo

## Data Loading
- Server components should load data before rendering
- Use proper loading states and error boundaries
- Follow Next.js App Router patterns for data fetching
- Handle edge cases (empty states, errors, slow connections)

## Safety / Security
- Never commit secrets
- Do not add analytics/trackers unless explicitly requested
- Follow the three-layer security model (route protection, API auth, RLS policies)
- Use SDK abstractions (`@uth/db`, `@uth/auth-server`) instead of direct client imports
