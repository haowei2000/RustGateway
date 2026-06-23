/* ───────────────────────────────────────────────────────────────────────────
 * _ds_bundle.js — local shim for the "LLM Gateway Admin UI" design system.
 *
 * The real generated bundle (esbuild of the .tsx component library, ~268 KB)
 * exceeds the design MCP's 256 KiB get_file cap, so it can't be pulled intact.
 * The console only consumes 9 primitives from `window.AdminUI`, so this file
 * re-implements exactly those with inline styles driven by the SAME design
 * tokens defined in _ds_bundle.css (:root --primary, --secondary, …).
 *
 * Faithful enough to run the prototype offline; not byte-identical to the
 * originals. Loaded as a plain <script> (no JSX) before Babel, so it uses
 * React.createElement and relies on the global `React` (from CDN UMD).
 * ─────────────────────────────────────────────────────────────────────────── */
(function () {
  const h = React.createElement;
  const merge = (...objs) => Object.assign({}, ...objs);

  /* PreviewProvider: the real bundle wraps the tree for the design pane;
     standalone it's a passthrough. */
  function PreviewProvider(props) {
    return h(React.Fragment, null, props.children);
  }

  /* ── Button ── */
  const BTN_BASE = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 6, whiteSpace: "nowrap", borderRadius: 8, border: 0, cursor: "pointer",
    fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, lineHeight: 1,
    transition: "background-color .12s ease, color .12s ease, opacity .12s ease",
  };
  const BTN_SIZE = {
    sm: { height: 32, padding: "0 12px", fontSize: 13 },
    default: { height: 36, padding: "0 16px" },
    icon: { height: 36, width: 36, padding: 0 },
  };
  function btnVariant(v) {
    switch (v) {
      case "outline": return { background: "transparent", color: "var(--foreground)", border: "1px solid var(--input)" };
      case "destructive": return { background: "var(--destructive)", color: "var(--destructive-foreground)" };
      case "secondary": return { background: "var(--secondary)", color: "var(--secondary-foreground)" };
      case "ghost": return { background: "transparent", color: "var(--foreground)" };
      default: return { background: "var(--primary)", color: "var(--primary-foreground)" };
    }
  }
  function Button(props) {
    const { variant = "default", size = "default", style, children, ...rest } = props;
    const s = merge(BTN_BASE, BTN_SIZE[size] || BTN_SIZE.default, btnVariant(variant), style || {});
    return h("button", merge({ style: s }, rest), children);
  }

  /* ── Badge ── */
  const BADGE_BASE = {
    display: "inline-flex", alignItems: "center", minHeight: 24, borderRadius: 6,
    padding: "2px 8px", fontSize: 12, fontWeight: 500, lineHeight: 1.2, whiteSpace: "nowrap",
  };
  function badgeVariant(v) {
    switch (v) {
      case "secondary": return { background: "var(--secondary)", color: "var(--secondary-foreground)" };
      case "destructive": return { background: "var(--destructive)", color: "var(--destructive-foreground)" };
      case "success": return { background: "#34374C", color: "#F6F6F6" };
      case "warning": return { background: "#EE2B47", color: "#F6F6F6" };
      case "outline": return { background: "transparent", color: "var(--foreground)", border: "1px solid var(--input)" };
      default: return { background: "var(--primary)", color: "var(--primary-foreground)" };
    }
  }
  function Badge(props) {
    const { variant = "default", style, children, ...rest } = props;
    return h("span", merge({ style: merge(BADGE_BASE, badgeVariant(variant), style || {}) }, rest), children);
  }

  /* ── Table family (shadcn-shaped) ── */
  function Table(props) {
    const { style, children, ...rest } = props;
    return h("table", merge({ style: merge({ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }, style || {}) }, rest), children);
  }
  function TableHeader(props) {
    const { style, children, ...rest } = props;
    return h("thead", merge({ style: style || undefined }, rest), children);
  }
  function TableBody(props) {
    const { style, children, ...rest } = props;
    return h("tbody", merge({ style: style || undefined }, rest), children);
  }
  function TableRow(props) {
    const { style, children, ...rest } = props;
    return h("tr", merge({ style: merge({ borderBottom: "1px solid var(--hair2, rgba(52,55,76,0.06))" }, style || {}) }, rest), children);
  }
  function TableHead(props) {
    const { style, children, ...rest } = props;
    const base = { height: 40, padding: "0 14px", textAlign: "left", verticalAlign: "middle", fontWeight: 600, fontSize: 12.5, color: "var(--muted-foreground)", whiteSpace: "nowrap" };
    return h("th", merge({ style: merge(base, style || {}) }, rest), children);
  }
  function TableCell(props) {
    const { style, children, ...rest } = props;
    return h("td", merge({ style: merge({ padding: "10px 14px", verticalAlign: "middle" }, style || {}) }, rest), children);
  }

  window.AdminUI = {
    PreviewProvider,
    Button, Badge,
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  };
})();
