/* Shared helpers + Dashboard / Providers / Routes views. Exposes window.Views. */
(function () {
  const A = window.AdminUI;
  const Icon = window.Icon;
  const { useState } = React;
  const D = window.DATA;

  /* ----------------------------- status colors ---------------------------- */
  const SC = {
    healthy: "#1f9d57", active: "#1f9d57", enabled: "#1f9d57",
    degraded: "#c98a12", rotating: "#c98a12",
    offline: "rgba(52,55,76,0.40)", disabled: "rgba(52,55,76,0.40)",
    revoked: "#EE2B47",
  };
  const KIND = {
    openai: "OpenAI", deepseek: "DeepSeek", anthropic: "Anthropic",
    azure: "Azure", self: "Self-host",
  };

  /* ------------------------------- primitives ------------------------------ */
  function Tip({ label, pos = "down", children, style, cls }) {
    return React.createElement(
      "span",
      { className: "tip tip-" + pos + (cls ? " " + cls : ""), "data-tip": label || "", style },
      children
    );
  }

  function IconBtn({ icon, tip, pos = "down", onClick, active, danger, size = 18 }) {
    return (
      <Tip label={tip} pos={pos}>
        <button
          className={"ibtn" + (active ? " on" : "")}
          onClick={onClick}
          style={danger ? { color: "#EE2B47" } : undefined}
          aria-label={tip}
        >
          <Icon name={icon} size={size} />
        </button>
      </Tip>
    );
  }

  function Dot({ status, size = 8 }) {
    const c = SC[status] || "rgba(52,55,76,0.4)";
    return (
      <span style={{
        width: size, height: size, borderRadius: "50%", background: c, flex: "0 0 auto",
        boxShadow: status === "healthy" || status === "active" ? `0 0 0 3px ${c}22` : "none",
        display: "inline-block",
      }} />
    );
  }

  function Field({ label, children, mono, grow }) {
    return (
      <label style={{ display: "block", flex: grow ? "1 1 0" : undefined, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", margin: "0 0 6px" }}>{label}</div>
        <div style={{
          background: "var(--fill)", borderRadius: 8, padding: "10px 13px", fontSize: 14,
          color: "#34374C", minHeight: 40, display: "flex", alignItems: "center", gap: 8,
          fontFamily: mono ? "var(--mono)" : "inherit", overflowWrap: "anywhere",
        }}>{children}</div>
      </label>
    );
  }

  function Section({ title, right, children, defaultOpen = true, badge }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <section style={{
        background: "#fff", border: "1px solid var(--hair)", borderRadius: 12, overflow: "hidden",
        boxShadow: "0 1px 2px rgba(52,55,76,0.04)",
      }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", cursor: "pointer" }}
          onClick={() => setOpen(o => !o)}>
          <button className="ibtn" style={{ width: 22, height: 22, transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s" }} aria-label="toggle">
            <Icon name="chevronDown" size={16} />
          </button>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 650, letterSpacing: "-0.01em" }}>{title}</h3>
          {badge != null && (
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 600 }}>{badge}</span>
          )}
          <div style={{ marginLeft: "auto" }} onClick={e => e.stopPropagation()}>{right}</div>
        </header>
        {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
      </section>
    );
  }

  function RowItem({ icon, title, subtitle, selected, onClick, trail }) {
    const [hov, setHov] = useState(false);
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
          padding: "9px 11px", border: "1px solid transparent", borderRadius: 9, cursor: "pointer",
          background: selected ? "var(--fill)" : hov ? "rgba(52,55,76,0.04)" : "transparent",
          boxShadow: selected ? "inset 2px 0 0 var(--ix)" : "none",
          color: "#34374C", font: "inherit", transition: "background .1s",
        }}
      >
        <span style={{ color: selected ? "var(--ix)" : "var(--muted-foreground)", display: "inline-flex", flex: "0 0 auto" }}>
          <Icon name={icon} size={16} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: selected ? 650 : 550, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>}
        </span>
        {trail}
      </button>
    );
  }

  function ListPanel({ title, count, onAdd, children }) {
    return (
      <aside style={{
        width: 270, flex: "0 0 270px", borderRight: "1px solid var(--hair)", background: "#fff",
        display: "flex", flexDirection: "column", minHeight: 0,
      }}>
        <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 14px 10px" }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>{title}</h2>
          {count != null && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)" }}>{count}</span>}
          <div style={{ marginLeft: "auto" }}>
            <IconBtn icon="plus" tip={"New " + title.replace(/s$/, "").toLowerCase()} pos="downr" onClick={onAdd} size={18} />
          </div>
        </header>
        <div className="scroll" style={{ padding: "0 8px 12px", display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>{children}</div>
      </aside>
    );
  }

  function MetricCard({ label, value, sub, accent }) {
    return (
      <div style={{
        flex: "1 1 0", minWidth: 0, background: "var(--muted)", borderRadius: 10,
        borderLeft: `3px solid ${accent || "var(--ix)"}`, padding: "12px 14px",
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>{label}</div>
        <div className="tnum" style={{ fontSize: 22, fontWeight: 680, marginTop: 2, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{sub}</div>}
      </div>
    );
  }

  function DetailHead({ icon, title, tag, status, actions }) {
    return (
      <header style={{
        display: "flex", alignItems: "center", gap: 14, padding: "16px 22px",
        borderBottom: "1px solid var(--hair)", background: "#fff", position: "sticky", top: 0, zIndex: 5,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11, background: "var(--secondary)", color: "#34374C",
          display: "grid", placeItems: "center", flex: "0 0 auto",
        }}>
          <Icon name={icon} size={22} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1>
            {tag && <A.Badge variant="secondary">{tag}</A.Badge>}
            {status && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted-foreground)", textTransform: "capitalize" }}>
                <Dot status={status} /> {status}
              </span>
            )}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>{actions}</div>
      </header>
    );
  }

  /* ------------------------------- Dashboard ------------------------------- */
  function StatCard({ s }) {
    const max = Math.max.apply(null, s.spark);
    return (
      <div style={{
        flex: "1 1 200px", minWidth: 0, background: "#fff", border: "1px solid var(--hair)",
        borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 2px rgba(52,55,76,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--muted-foreground)", display: "inline-flex" }}><Icon name={s.icon} size={16} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted-foreground)" }}>{s.label}</span>
        </div>
        <div className="tnum" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 8, lineHeight: 1 }}>{s.value}</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10, gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: s.up ? "#1f9d57" : "#EE2B47" }}>
            <Icon name={s.up ? "arrowUp" : "arrowDown"} size={13} /> {s.delta}
          </span>
          <span className="spark" style={{ width: 78 }}>
            {s.spark.map((v, i) => <i key={i} style={{ height: (v / max * 100) + "%" }} />)}
          </span>
        </div>
      </div>
    );
  }

  function Dashboard() {
    const max = Math.max.apply(null, D.VOLUME);
    return (
      <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 26px", borderBottom: "1px solid var(--hair)", background: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Overview</h1>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--muted-foreground)", marginLeft: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1f9d57", boxShadow: "0 0 0 3px rgba(31,157,87,0.18)" }} /> All systems operational
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted-foreground)", fontWeight: 600, padding: "0 6px" }}>Last 24h</span>
          <IconBtn icon="search" tip="Search" pos="downr" />
          <IconBtn icon="rotateCw" tip="Refresh" pos="downr" />
        </div>
      </header>
      <div className="scroll" style={{ flex: 1, padding: "22px 26px", minHeight: 0 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
          {D.STATS.map(s => <StatCard key={s.id} s={s} />)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "#fff", border: "1px solid var(--hair)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Request volume</h3>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>last 24 hours · k req/h</span>
            </div>
            <div className="bars">
              {D.VOLUME.map((v, i) => (
                <Tip key={i} label={v + "k · " + String((i + 0) % 24).padStart(2, "0") + ":00"} pos="down" cls="bar-wrap" style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                  <span className="bar" style={{ height: (v / max * 100) + "%", width: "100%" }} />
                </Tip>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--hair)", borderRadius: 12, padding: "16px 18px" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 650 }}>Provider mix</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {D.PROVIDERS.map(p => (
                <div key={p.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Dot status={p.status} size={7} /> {p.name}</span>
                    <span className="tnum" style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{p.share}%</span>
                  </div>
                  <div style={{ height: 7, background: "var(--fill)", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: p.share + "%", background: "var(--ix)", borderRadius: 99, opacity: p.status === "offline" ? 0.35 : 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "#fff", border: "1px solid var(--hair)", borderRadius: 12, padding: "8px 8px 10px" }}>
            <h3 style={{ margin: "10px 12px 6px", fontSize: 14, fontWeight: 650 }}>Recent changes</h3>
            {D.AUDIT_OPS.slice(0, 4).map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8 }}>
                <span style={{ color: "var(--muted-foreground)" }}><Icon name="scroll" size={15} /></span>
                <span style={{ fontSize: 13, minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <b style={{ fontWeight: 600 }}>{o.actor}</b> <span style={{ color: "var(--muted-foreground)" }}>{o.action}d</span> {o.target}
                </span>
                <span className="tnum" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{o.time}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "#fff", border: "1px solid var(--hair)", borderRadius: 12, padding: "8px 8px 10px" }}>
            <h3 style={{ margin: "10px 12px 6px", fontSize: 14, fontWeight: 650 }}>Upstream health</h3>
            {D.PROVIDERS.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8 }}>
                <Dot status={p.status} />
                <span style={{ fontSize: 13, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                <span className="tnum" style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{p.status === "offline" ? "—" : p.p95 + " ms"}</span>
                <span className="tnum" style={{ fontSize: 12.5, width: 52, textAlign: "right", color: p.errRate > 1 ? "#EE2B47" : "var(--muted-foreground)" }}>{p.status === "offline" ? "—" : p.errRate + "%"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    );
  }

  /* ------------------------------- Providers ------------------------------- */
  function Providers() {
    const [sel, setSel] = useState(D.PROVIDERS[0].id);
    const [reveal, setReveal] = useState(false);
    const [copied, setCopied] = useState(false);
    const p = D.PROVIDERS.find(x => x.id === sel);

    function copy() { setCopied(true); setTimeout(() => setCopied(false), 1200); }

    return (
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <ListPanel title="Providers" count={D.PROVIDERS.length}>
          {D.PROVIDERS.map(x => (
            <RowItem key={x.id} icon="database" title={x.name} subtitle={KIND[x.kind] + " · " + x.models + " models"}
              selected={x.id === sel} onClick={() => { setSel(x.id); setReveal(false); }}
              trail={<Dot status={x.status} />} />
          ))}
        </ListPanel>

        <div className="scroll fade-in" key={sel} style={{ flex: 1, minWidth: 0 }}>
          <DetailHead icon="database" title={p.name} tag={KIND[p.kind]} status={p.status}
            actions={<>
              <IconBtn icon="rotateCw" tip="Test connection" pos="down" />
              <IconBtn icon="trash" tip="Delete provider" pos="down" danger />
              <A.Button size="sm"><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="save" size={15} /> Save</span></A.Button>
            </>} />

          <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 920 }}>
            <Section title="Connection">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Display name">{p.name}</Field>
                <div style={{ display: "flex", gap: 14 }}>
                  <Field label="Base URL" mono grow>{p.baseUrl}</Field>
                  <Field label="Region">{p.region}</Field>
                </div>
                <Field label="API key" mono>
                  <span style={{ flex: 1 }}>{p.keyMasked === "—" ? "—" : (reveal ? "sk-live-7f3a9c2e1b88d4a0" : p.keyMasked)}</span>
                  {p.keyMasked !== "—" && <>
                    <IconBtn icon={copied ? "check" : "copy"} tip={copied ? "Copied" : "Copy"} pos="left" size={15} onClick={copy} />
                    <IconBtn icon="rotateCw" tip="Rotate key" pos="left" size={15} />
                    <button className="ibtn" style={{ width: "auto", padding: "0 10px", fontSize: 12.5, fontWeight: 600, color: "var(--muted-foreground)" }} onClick={() => setReveal(r => !r)}>{reveal ? "Hide" : "Reveal"}</button>
                  </>}
                </Field>
              </div>
            </Section>

            <Section title="Health" defaultOpen>
              <div style={{ display: "flex", gap: 12 }}>
                <MetricCard label="p95 latency" value={p.status === "offline" ? "—" : p.p95 + " ms"} accent="var(--ix)" />
                <MetricCard label="Error rate" value={p.status === "offline" ? "—" : p.errRate + "%"} accent={p.errRate > 1 ? "#EE2B47" : "#1f9d57"} />
                <MetricCard label="Traffic share" value={p.share + "%"} accent="var(--ix)" />
                <MetricCard label="Models" value={p.models} sub={p.policies + " policies"} accent="var(--ix)" />
              </div>
            </Section>

            <Section title="Mapped models" badge={p.models}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {D.MODELS.slice(0, 3).map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--muted)", borderRadius: 9 }}>
                    <span style={{ color: "var(--muted-foreground)" }}><Icon name="layers" size={15} /></span>
                    <span style={{ fontSize: 13.5, fontWeight: 550, flex: 1 }}>{m.name}</span>
                    <A.Badge variant="outline">{m.type}</A.Badge>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------- Routes -------------------------------- */
  function Routes() {
    const models = Array.from(new Set(D.ROUTES.map(r => r.model)));
    const [model, setModel] = useState(models[0]);
    const rows = D.ROUTES.filter(r => r.model === model);
    const palette = ["var(--ix)", "#1f9d57", "#c98a12", "rgba(52,55,76,0.4)"];

    return (
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <ListPanel title="Models" count={models.length}>
          {models.map(m => (
            <RowItem key={m} icon="layers" title={m} subtitle={D.ROUTES.filter(r => r.model === m).length + " targets"}
              selected={m === model} onClick={() => setModel(m)} />
          ))}
        </ListPanel>

        <div className="scroll fade-in" key={model} style={{ flex: 1, minWidth: 0 }}>
          <DetailHead icon="shuffle" title={model} tag="route" status="enabled"
            actions={<>
              <Tip label="Add target" pos="down"><A.Button size="sm" variant="outline"><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="plus" size={15} /> Target</span></A.Button></Tip>
              <A.Button size="sm"><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="save" size={15} /> Save</span></A.Button>
            </>} />

          <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 920 }}>
            <Section title="Weight distribution">
              <div style={{ display: "flex", height: 18, borderRadius: 7, overflow: "hidden", background: "var(--fill)" }}>
                {rows.map((r, i) => r.weight > 0 && (
                  <Tip key={r.id} label={r.provider + " · " + r.weight + "%"} pos="down" style={{ width: r.weight + "%" }}>
                    <span style={{ display: "block", width: "100%", height: 18, background: palette[i % palette.length] }} />
                  </Tip>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
                {rows.map((r, i) => (
                  <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--muted-foreground)" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: palette[i % palette.length] }} /> {r.provider} · <b style={{ color: "#34374C" }}>{r.weight}%</b>
                  </span>
                ))}
              </div>
            </Section>

            <Section title="Targets" badge={rows.length}>
              <A.Table>
                <A.TableHeader>
                  <A.TableRow>
                    <A.TableHead>Provider model</A.TableHead>
                    <A.TableHead>Upstream</A.TableHead>
                    <A.TableHead>Weight</A.TableHead>
                    <A.TableHead>Status</A.TableHead>
                    <A.TableHead></A.TableHead>
                  </A.TableRow>
                </A.TableHeader>
                <A.TableBody>
                  {rows.map(r => (
                    <A.TableRow key={r.id}>
                      <A.TableCell style={{ fontWeight: 600, fontFamily: "var(--mono)", fontSize: 13 }}>{r.target}</A.TableCell>
                      <A.TableCell style={{ color: "var(--muted-foreground)" }}>{r.provider}</A.TableCell>
                      <A.TableCell>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
                          <div style={{ flex: 1, height: 6, background: "var(--fill)", borderRadius: 99 }}>
                            <div style={{ height: "100%", width: r.weight + "%", background: "var(--ix)", borderRadius: 99 }} />
                          </div>
                          <span className="tnum" style={{ fontSize: 12.5, width: 34, textAlign: "right" }}>{r.weight}%</span>
                        </div>
                      </A.TableCell>
                      <A.TableCell><A.Badge variant={r.status === "enabled" ? "success" : "outline"}>{r.status}</A.Badge></A.TableCell>
                      <A.TableCell>
                        <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                          <IconBtn icon="sliders" tip="Edit weight" pos="left" size={15} />
                          <IconBtn icon="trash" tip="Remove" pos="left" size={15} danger />
                        </div>
                      </A.TableCell>
                    </A.TableRow>
                  ))}
                </A.TableBody>
              </A.Table>
            </Section>
          </div>
        </div>
      </div>
    );
  }

  window.Views = Object.assign(window.Views || {}, {
    Tip, IconBtn, Dot, Field, Section, RowItem, ListPanel, MetricCard, DetailHead,
    SC, KIND, Dashboard, Providers, Routes,
  });
})();
