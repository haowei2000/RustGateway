/* App shell: dark icon rail (expandable) + content router + Tweaks. */
(function () {
  const A = window.AdminUI;
  const Icon = window.Icon;
  const V = window.Views;
  const { useState, useEffect } = React;
  const { useTweaks, TweaksPanel, TweakSection, TweakRadio } = window;

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "gauge", view: V.Dashboard },
    { id: "providers", label: "Providers", icon: "database", view: V.Providers },
    { id: "routes", label: "Routes", icon: "shuffle", view: V.Routes },
    { id: "keys", label: "API Keys", icon: "keyRound", view: V.Keys },
    { id: "config", label: "Config", icon: "sliders", view: V.Config },
    { id: "audit", label: "Audit", icon: "scroll", view: V.Audit },
  ];

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "nav": "rail",
    "tipTheme": "dark",
    "accent": "restrained"
  }/*EDITMODE-END*/;

  function NavBtn({ item, active, expanded, onClick }) {
    const [hov, setHov] = useState(false);
    const inner = (
      <button
        onClick={onClick}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        aria-label={item.label} aria-current={active ? "page" : undefined}
        style={{
          position: "relative", display: "flex", alignItems: "center",
          gap: 12, width: "100%", height: 42, padding: expanded ? "0 12px" : 0,
          justifyContent: expanded ? "flex-start" : "center",
          border: 0, borderRadius: 10, cursor: "pointer", font: "inherit",
          background: active ? "var(--sidebar-accent)" : hov ? "rgba(255,255,255,0.06)" : "transparent",
          color: active ? "#fff" : hov ? "#fff" : "var(--sidebar-muted)",
          transition: "background .12s, color .12s",
        }}
      >
        {active && <span style={{ position: "absolute", left: 0, top: 9, bottom: 9, width: 3, borderRadius: 99, background: "var(--railix)" }} />}
        <Icon name={item.icon} size={19} stroke={active ? 2.2 : 2} />
        {expanded && <span style={{ fontSize: 13.5, fontWeight: active ? 650 : 550, whiteSpace: "nowrap" }}>{item.label}</span>}
      </button>
    );
    if (expanded) return inner;
    return <V.Tip label={item.label} pos="right" style={{ width: "100%" }}>{inner}</V.Tip>;
  }

  function App() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const [mod, setMod] = useState("dashboard");
    const expanded = t.nav === "wide";

    useEffect(() => {
      document.body.setAttribute("data-tiptheme", t.tipTheme);
      const b = document.body.style;
      if (t.accent === "vivid") { b.setProperty("--ix", "#EE2B47"); b.setProperty("--ixc", "#ffffff"); b.setProperty("--railix", "#EE2B47"); }
      else { b.setProperty("--ix", "#34374C"); b.setProperty("--ixc", "#F6F6F6"); b.setProperty("--railix", "rgba(246,246,246,0.92)"); }
    }, [t.tipTheme, t.accent]);

    const Current = NAV.find(n => n.id === mod).view;

    return (
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F6F6F6" }}>
        {/* icon rail */}
        <nav style={{
          width: expanded ? 232 : 64, flex: "0 0 auto", background: "var(--sidebar)", color: "var(--sidebar-foreground)",
          display: "flex", flexDirection: "column", padding: "12px 10px", transition: "width .18s ease", overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: expanded ? "4px 6px 4px 4px" : 0, justifyContent: expanded ? "flex-start" : "center", height: 40, marginBottom: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: "#EE2B47", color: "#fff", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
              <Icon name="shuffle" size={18} stroke={2.4} />
            </span>
            {expanded && <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>EpicHust</div>
              <div style={{ fontSize: 11, color: "var(--sidebar-muted)", whiteSpace: "nowrap" }}>LLM Gateway</div>
            </div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
            {NAV.map(n => <NavBtn key={n.id} item={n} active={mod === n.id} expanded={expanded} onClick={() => setMod(n.id)} />)}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 3, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
            <V.Tip label={expanded ? "" : "Expand"} pos="right" style={{ width: "100%" }}>
              <button onClick={() => setTweak("nav", expanded ? "rail" : "wide")} aria-label="Toggle navigation"
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", height: 40, padding: expanded ? "0 12px" : 0, justifyContent: expanded ? "flex-start" : "center", border: 0, borderRadius: 10, cursor: "pointer", background: "transparent", color: "var(--sidebar-muted)", font: "inherit" }}
                onMouseEnter={e => e.currentTarget.style.color = "#fff"} onMouseLeave={e => e.currentTarget.style.color = "var(--sidebar-muted)"}>
                <Icon name={expanded ? "panelClose" : "panelOpen"} size={19} />
                {expanded && <span style={{ fontSize: 13.5, fontWeight: 550 }}>Collapse</span>}
              </button>
            </V.Tip>
            <V.Tip label={expanded ? "" : "li.wei · Admin"} pos="right" style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: expanded ? "6px 8px" : 0, justifyContent: expanded ? "flex-start" : "center", height: 42, borderRadius: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--sidebar-accent)", color: "#fff", display: "grid", placeItems: "center", flex: "0 0 auto", fontSize: 12, fontWeight: 700 }}>LW</span>
                {expanded && <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>li.wei</div>
                  <div style={{ fontSize: 11, color: "var(--sidebar-muted)", whiteSpace: "nowrap" }}>Admin</div>
                </div>}
              </div>
            </V.Tip>
          </div>
        </nav>

        {/* content */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "#F6F6F6" }}>
          <Current key={mod} />
        </main>

        <TweaksPanel>
          <TweakSection label="Navigation" />
          <TweakRadio label="Sidebar" value={t.nav} options={["rail", "wide"]} onChange={v => setTweak("nav", v)} />
          <TweakSection label="Tooltips" />
          <TweakRadio label="Style" value={t.tipTheme} options={["dark", "light", "accent"]} onChange={v => setTweak("tipTheme", v)} />
          <TweakSection label="Accent" />
          <TweakRadio label="Usage" value={t.accent} options={["restrained", "vivid"]} onChange={v => setTweak("accent", v)} />
        </TweaksPanel>
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    React.createElement(A.PreviewProvider, null, React.createElement(App))
  );
})();
