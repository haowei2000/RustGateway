# LLM Gateway Admin UI — how to build with this design system

A small shadcn/ui-style React kit (the admin console for an LLM gateway). Two groups:
**general** (UI primitives) and **layout** (the dark sidebar shell). Components are
imported from the bundle global `window.AdminUI` (e.g. `AdminUI.Button`).

## Setup & wrapping

- **No theme provider needed.** All design tokens are plain CSS variables on `:root`
  (shipped in `styles.css`). Just render components; they read the tokens directly.
- **One data-bound exception:** `Sidebar` reads a TanStack Query cache (key
  `["admin-data"]`). In a real app, wrap the tree in a `QueryClientProvider` and seed
  that key, or compose the sidebar yourself from `SidebarButtonGroup` + `ItemList`
  (which take plain props).
- **Sidebar-context components must sit on a dark background.** `Item`, `ItemList`,
  `Sidebar`, `SidebarButtonGroup`, and the `Item*` sub-parts use light "sidebar" text
  and are invisible on white. Place them inside a `background: var(--sidebar)` panel.
  The `LongItem*` family and everything else is for normal light surfaces.

## Styling idiom — props + brand CSS variables (NOT arbitrary utilities)

This kit predates a live Tailwind JIT in the design runtime: `styles.css` is a
**static compiled stylesheet** containing only the utility classes the components
themselves use. So:

1. **Choose variants via props**, not classes:
   - `Button` — `variant`: `default | secondary | outline | ghost`; `size`: `default | sm | lg | icon`.
   - `Badge` — `variant`: `default | secondary | destructive | success | warning | outline`.
     (Note: `success` is navy like `default`, `warning` is red like `destructive`.)
   - `Item` — `selected` (boolean) highlights a sidebar row.
2. **Style your own layout with the brand CSS variables** (all guaranteed defined) via
   `style={{ ... }}` — do not assume `bg-*`/`gap-*` utilities you invent will resolve.
   Surfaces: `--background` `--foreground` `--card` `--primary`/`--primary-foreground`
   `--secondary`/`--secondary-foreground` `--muted`/`--muted-foreground` `--accent`
   (brand red) `--destructive` `--border` `--input` `--ring` `--radius`.
   Sidebar: `--sidebar` `--sidebar-foreground` `--sidebar-muted` `--sidebar-accent`
   `--sidebar-accent-foreground`.
3. Every component forwards `className` and `style`, so you can extend an instance, but
   prefer the variants above for anything the kit already expresses.

Brand: navy `--primary` (#34374C), light `--secondary` (#E8E9EC), red `--accent`
(#EE2B47), on a near-white `--background` (#F6F6F6). Font is **Inter** (shipped).

## Where the truth lives

- `styles.css` — imports the compiled tokens/utilities and the Inter `@font-face`. Read
  it before styling to see exactly which utilities and tokens exist.
- Per component: `components/<group>/<Name>/<Name>.d.ts` (the props contract the agent
  codes against) and `<Name>.prompt.md` (usage). Compound parts (e.g. `Card` +
  `CardHeader`/`CardContent`/`CardTitle`, `Table` + `TableRow`/`TableCell`/…, the
  `Item`/`LongItem` families) are composed together.

## One idiomatic example

```jsx
const { Card, CardHeader, CardTitle, CardContent, Badge, Button } = window.AdminUI

function ProviderCard() {
  return (
    <div style={{ maxWidth: 420 }}>
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <CardTitle>OpenAI Production</CardTitle>
            <Badge variant="success">enabled</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p style={{ margin: 0, color: "var(--muted-foreground)" }}>
            12 models across 3 mapping policies.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Button size="sm">Manage models</Button>
            <Button size="sm" variant="outline">Edit</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```
