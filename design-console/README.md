# API Gateway Console (imported design prototype)

Imported from the Claude Design project **"LLM Gateway Admin UI"**
(`claude.ai/design/p/663b735b-9a02-4733-8094-7efea45c203c`) via the
`claude_design` MCP connector, and made runnable locally.

It's a self-contained React prototype (React 18 + Babel-in-browser) of the
admin console: **Dashboard / Providers / Routes / API Keys / Config / Audit**,
with a collapsible dark icon rail and a floating "Tweaks" panel.

## Run it

Babel fetches the `.jsx` files over HTTP, so open it through a static server
(not `file://`):

```bash
cd design-console
python3 -m http.server 8088
# then open:  http://localhost:8088/console/API%20Gateway%20Console.html
```

## Layout

```
design-console/
├─ console/
│  ├─ API Gateway Console.html   ← entry point
│  ├─ app.jsx                    ← shell: icon rail + view router + Tweaks
│  ├─ views-core.jsx             ← Dashboard / Providers / Routes (+ shared helpers)
│  ├─ views-admin.jsx            ← API Keys / Config / Audit
│  ├─ data.js                    ← mock data
│  └─ icons.jsx                  ← lucide-style icon set
├─ _ds_bundle.css                ← design tokens + Tailwind utilities (imported intact)
├─ _ds_bundle.js                 ← SHIM (see note) → window.AdminUI
├─ styles.css                    ← @imports fonts + _ds_bundle.css
└─ fonts/fonts.css               ← stub (Inter falls back to system fonts)
```

## ⚠️ One faithful deviation: `_ds_bundle.js`

The design project's generated component bundle is **267.6 KB**, which exceeds
the design MCP's `get_file` **256 KiB** read cap — it can only be fetched
truncated, so it won't evaluate. The console only consumes **9 primitives**
from `window.AdminUI` (`Button`, `Badge`, and the `Table` family +
`PreviewProvider`), so `_ds_bundle.js` here is a small hand-written **shim**
that re-implements exactly those, styled from the real design tokens in
`_ds_bundle.css`. It's visually faithful but **not byte-identical** to the
original components.

Likewise, the HTML loads React 18 UMD from unpkg instead of the project's
`_vendor/react*.js` (also over the cap); Babel was already CDN-loaded upstream.

To restore the exact originals, drop the full `_ds_bundle.js` (and
`_vendor/react.js`, `_vendor/react-dom.js`) from the design project in place and
revert the `<script>` srcs in the HTML.

The design components mirror the real `admin-web/src/components` — so this
prototype is best treated as the **spec** for building these screens natively in
the Vite app.
