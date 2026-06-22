# design-sync notes — llm-gateway-admin-web

This repo is the **admin-web app**, not a published component library. The design
system is the shadcn/ui-style component set under `src/components/{ui,layout}`.

## Build mechanics (important — re-sync must replay these)

- **App, not a library → synth-entry mode.** There is no `dist/` library entry; the
  converter synthesizes the entry from `src/`. Run with no `--entry`.
- **Self-link required.** The converter resolves the package at
  `node_modules/<pkg>`. An app repo isn't self-installed, so create the self-link
  before building (recreate on fresh clones):
  `ln -sfn "$(pwd)" node_modules/llm-gateway-admin-web`
- **`srcDir` scoped to `src/components`.** Scanning all of `src/` pulls in
  `App.tsx`, `main.tsx`, and `features/admin/*` pages. `main.tsx` imports
  `@/index.css` (`@import "tailwindcss"`) which esbuild cannot resolve → bundle
  fails. Keep `srcDir: "src/components"`.
- **Tailwind v4 must be compiled to static CSS before each converter build.**
  Components are styled with Tailwind utility classes generated at build time;
  the raw `src/index.css` only holds `@import "tailwindcss"` + `@theme` tokens.
  `cfg.buildCmd` compiles `.design-sync/build/ds-styles.css` →
  `.design-sync/build/compiled.css` (the `cfg.cssEntry`). The entry `@source`s
  both `src` and `.design-sync/previews` so preview utility classes also emit.
  **Run `cfg.buildCmd` before every `package-build.mjs` run.**
- **Preview provider.** `Sidebar` uses `useAdminData()` (TanStack Query, key
  `["admin-data"]`). `.design-sync/preview-provider.tsx` exports `PreviewProvider`
  (a seeded `QueryClientProvider`), wired via `extraEntries` + `cfg.provider`.
  It's harmless for the presentational components.

## Authoring conventions

- Previews import from the package name: `import { Button } from "llm-gateway-admin-web"`.
- Icons in previews: use `className="icon-sm"` (defined as 1rem in
  `src/styles/app.css`). Avoid arbitrary `size-*` utilities unless already used in
  `src/` — the Tailwind scan only emits classes it finds (previews are scanned via
  `@source`, but icon-sm is the established idiom).
- **Modal/overlay components** (`AddItemModal`, `InputModal`) render a
  `position: fixed` `.modal-overlay`. Wrap the preview in a container with
  `transform: translateZ(0)` + an explicit width/height so the fixed layer is
  contained in the card instead of escaping the viewport. Also set
  `cfg.overrides.<Name> = {cardMode: single, viewport}`.

## Component inventory

34 exports = ~15 logical components + shadcn-style compound sub-parts
(Card→CardHeader/Content/Title, Table→Body/Cell/Head/Header/Row,
Item→ItemContent/Detail/Eyebrow/Icon/Meta/Title, LongItem→… ). All stay importable;
all are authored per user request (compound sub-parts shown in realistic context).

Default sidebar resource is `keys` → Sidebar renders the API-keys list from the
seeded mock.

## Authoring patterns that worked (folded from fan-out wave)

- **Dark container for sidebar-colored components.** `Item*` and the layout pieces
  (`Sidebar`, `ItemList`, `SidebarButtonGroup`) use light "sidebar" text colors and
  are invisible on the white review card. Wrap their previews in
  `<div style={{ background: "var(--sidebar)", padding: 12, borderRadius: 10, width: 240 }}>`.
- **`ItemDetail` is a hover popover** (`opacity:0`, translated off, absolutely
  positioned to the right). Force it visible in previews by passing inline
  `style={{ opacity: 1, transform: "translateX(0) translateY(-50%)" }}` (it spreads
  `...props`), and give the container `paddingTop/Bottom: 36` + `paddingRight: 150`
  so the centered popover isn't clipped. Keep `ItemMeta` to one line.
- **Overlay components** (`AddItemModal`, `InputModal`): the `Stage` transform-wrapper
  in `previews/AddItemModal.tsx` (`transform: translateZ(0)` + fixed w/h) contains the
  `position:fixed` overlay. Reuse it for any future overlay.
- **Tables**: `even:bg-secondary/20` zebra needs 4-5 rows to read; numeric columns use
  `style={{ textAlign:"right", fontVariantNumeric:"tabular-nums" }}` on both
  `TableHead` and `TableCell`.
- **Sidebar** takes no props — it populates from the seeded `PreviewProvider`
  (`["admin-data"]` mock); confirmed it renders the 3 mock API keys.

## Known render warns (re-syncs: these are expected, not new)

- `SidebarResizeHandle` is an intentional 4px drag bar → may trip `[RENDER_THIN]`. OK.
- `Sidebar` rows spread vertically (`.item-list-body` is `flex:1 1 auto`) in a tall
  frame — expected layout, not a defect.

## Design observations (component source, NOT preview bugs — flag to maintainers)

- `src/components/ui/badge.tsx`: `success` variant → navy `#34374C` (identical to
  `default`) and `warning` → red `#EE2B47` (identical to `destructive`). Previews
  render the components faithfully; if differentiated semantic colors (green/amber)
  were intended, the component source needs changing, not the previews.

## Re-sync risks

- **`.design-sync/build/compiled.css` is generated, gitignored.** It MUST be
  regenerated (`cfg.buildCmd`) before the converter on every re-sync, or the bundle
  ships stale/empty CSS. This is the single most important re-sync step.
- **Self-link is gitignored** (`node_modules`) — recreate on fresh clones.
- **PreviewProvider mock data is inlined** in `preview-provider.tsx`; if the
  `AdminData` shape or `ApiKeySummary` fields change, update the mock or Sidebar
  renders empty/throws.
